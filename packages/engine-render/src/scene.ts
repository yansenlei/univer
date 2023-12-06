import type { IKeyValue, Nullable } from '@univerjs/core';
import { sortRules, sortRulesByDesc } from '@univerjs/core';
import { BehaviorSubject } from 'rxjs';

import type { BaseObject } from './base-object';
import { CURSOR_TYPE, RENDER_CLASS_TYPE } from './basics/const';
import type { IKeyboardEvent, IMouseEvent, IPointerEvent, IWheelEvent } from './basics/i-events';
import type { IObjectFullState, ISceneTransformState, ITransformChangeState } from './basics/interfaces';
import { TRANSFORM_CHANGE_OBSERVABLE_TYPE } from './basics/interfaces';
import { precisionTo, requestNewFrame } from './basics/tools';
import { Transform } from './basics/transform';
import type { IBoundRect } from './basics/vector2';
import { Vector2 } from './basics/vector2';
import { Layer } from './layer';
import type { ITransformerConfig } from './scene.-transformer';
import { Transformer } from './scene.-transformer';
import { InputManager } from './scene.input-manager';
import type { SceneViewer } from './scene-viewer';
import type { ThinEngine } from './thin-engine';
import { ThinScene } from './thin-scene';
import type { Viewport } from './viewport';

export class Scene extends ThinScene {
    private _layers: Layer[] = [];

    private _viewports: Viewport[] = [];

    private _isFirstDirty: boolean = true;

    private _maxZIndex: number = 0;

    private _cursor: CURSOR_TYPE = CURSOR_TYPE.DEFAULT;

    private _defaultCursor: CURSOR_TYPE = CURSOR_TYPE.DEFAULT;

    private _addObject$ = new BehaviorSubject<Scene>(this);

    readonly addObject$ = this._addObject$.asObservable();

    /**
     * Transformer constructor.  Transformer is a special type of group that allow you transform
     * primitives and shapes. Transforming tool is not changing `width` and `height` properties of nodes
     * when you resize them. Instead it changes `scaleX` and `scaleY` properties.
     */
    private _transformer: Nullable<Transformer>;

    private _transformerOpenState = false;

    /** @hidden */
    private _inputManager: Nullable<InputManager>;

    constructor(
        sceneKey: string,
        private _parent: ThinEngine<Scene> | SceneViewer,
        state?: ISceneTransformState
    ) {
        super(sceneKey);

        if (state) {
            this.transformByState(state);
        }

        if (this._parent.classType === RENDER_CLASS_TYPE.ENGINE) {
            const parent = this._parent as ThinEngine<Scene>;
            parent.addScene(this);
            if (!parent.hasActiveScene()) {
                parent.setActiveScene(sceneKey);
            }
            this._inputManager = new InputManager(this);
        } else if (this._parent.classType === RENDER_CLASS_TYPE.SCENE_VIEWER) {
            // 挂载到sceneViewer的scene需要响应前者的transform
            const parent = this._parent as SceneViewer;
            parent.addSubScene(this);
        }
        this._parent?.onTransformChangeObservable.add((change: ITransformChangeState) => {
            this._setTransForm();
        });

        // setTimeout(() => {
        //     document.querySelector('body')?.appendChild(this.getAllObjects()[0]._cacheCanvas._canvasEle);
        // }, 500);
    }

    get ancestorScaleX() {
        const p = this.getParent();
        let pScale = 1;
        if (p.classType === RENDER_CLASS_TYPE.SCENE_VIEWER) {
            pScale = (p as SceneViewer).ancestorScaleX;
        }
        return this.scaleX * pScale;
    }

    get ancestorScaleY() {
        const p = this.getParent();
        let pScale = 1;
        if (p.classType === RENDER_CLASS_TYPE.SCENE_VIEWER) {
            pScale = (p as SceneViewer).ancestorScaleY;
        }
        return this.scaleY * pScale;
    }

    set cursor(val: CURSOR_TYPE) {
        this.setCursor(val);
    }

    attachControl(hasDown: boolean = true, hasUp: boolean = true, hasMove: boolean = true, hasWheel: boolean = true) {
        if (!(this._parent.classType === RENDER_CLASS_TYPE.ENGINE)) {
            // 只绑定直接与engine挂载的scene来统一管理事件
            return;
        }

        this._inputManager?.attachControl(hasDown, hasUp, hasMove, hasWheel);
        return this;
    }

    detachControl() {
        this._inputManager?.detachControl();
        return this;
    }

    override makeDirty(state: boolean = true) {
        this._layers.forEach((vp) => {
            vp.makeDirty(state);
        });
        if (this._parent.classType === RENDER_CLASS_TYPE.SCENE_VIEWER) {
            (this._parent as SceneViewer)?.makeDirty(state);
        }
        return this;
    }

    override makeDirtyNoParent(state: boolean = true) {
        this._viewports.forEach((vp) => {
            vp.makeDirty(state);
        });
        return this;
    }

    isDirty(): boolean {
        for (let i = 0; i < this._layers.length; i++) {
            const layer = this._layers[i];
            if (layer.isDirty() === true) {
                return true;
            }
        }
        return false;
    }

    resetCursor() {
        this.setCursor(this._defaultCursor);
    }

    setCursor(val: CURSOR_TYPE) {
        this._cursor = val;
        const engine = this.getEngine();
        if (!engine) {
            return;
        }
        engine.setCanvasCursor(val);
    }

    setDefaultCursor(val: CURSOR_TYPE) {
        this._defaultCursor = val;
        this.resetCursor();
    }

    resize(width?: number, height?: number) {
        const preWidth = this.width;
        if (width !== undefined) {
            this.width = width;
        }

        const preHeight = this.height;
        if (height !== undefined) {
            this.height = height;
        }

        this._setTransForm();
        this.onTransformChangeObservable.notifyObservers({
            type: TRANSFORM_CHANGE_OBSERVABLE_TYPE.resize,
            value: {
                width: this.width,
                height: this.height,
            },
            preValue: { width: preWidth, height: preHeight },
        });
        return this;
    }

    /**
     * scale to value, absolute
     */
    scale(scaleX?: number, scaleY?: number) {
        const preScaleX = this.scaleX;
        if (scaleX !== undefined) {
            this.scaleX = scaleX;
        }

        const preScaleY = this.scaleY;
        if (scaleY !== undefined) {
            this.scaleY = scaleY;
        }

        this._setTransForm();
        this.onTransformChangeObservable.notifyObservers({
            type: TRANSFORM_CHANGE_OBSERVABLE_TYPE.scale,
            value: {
                scaleX: this.scaleX,
                scaleY: this.scaleY,
            },
            preValue: { scaleX: preScaleX, scaleY: preScaleY },
        });
        return this;
    }

    /**
     * current scale plus offset, relative
     */
    scaleBy(scaleX?: number, scaleY?: number) {
        const preScaleX = this.scaleX;
        if (scaleX !== undefined) {
            this.scaleX += scaleX;
        }
        const preScaleY = this.scaleY;
        if (scaleY !== undefined) {
            this.scaleY += scaleY;
        }

        this.scaleX = precisionTo(this.scaleX, 1);
        this.scaleY = precisionTo(this.scaleY, 1);

        this._setTransForm();
        this.onTransformChangeObservable.notifyObservers({
            type: TRANSFORM_CHANGE_OBSERVABLE_TYPE.scale,
            value: {
                scaleX: this.scaleX,
                scaleY: this.scaleY,
            },
            preValue: { scaleX: preScaleX, scaleY: preScaleY },
        });
        return this;
    }

    transformByState(state: ISceneTransformState) {
        const optionKeys = Object.keys(state);
        const preKeys: IObjectFullState = {};
        if (optionKeys.length === 0) {
            return;
        }

        optionKeys.forEach((pKey) => {
            if (state[pKey as keyof ISceneTransformState] !== undefined) {
                (preKeys as IKeyValue)[pKey] = this[pKey as keyof Scene];
                (this as IKeyValue)[pKey] = state[pKey as keyof ISceneTransformState];
            }
        });

        this._setTransForm();

        this.onTransformChangeObservable.notifyObservers({
            type: TRANSFORM_CHANGE_OBSERVABLE_TYPE.all,
            value: state,
            preValue: preKeys,
        });
    }

    override getParent(): ThinEngine<Scene> | SceneViewer {
        return this._parent;
    }

    override getEngine(): Nullable<ThinEngine<Scene>> {
        if (this._parent.classType === RENDER_CLASS_TYPE.ENGINE) {
            return this._parent as ThinEngine<Scene>;
        }

        let parent: any = this._parent; // type:  SceneViewer | Engine | BaseObject | Scene
        while (parent) {
            if (parent.classType === RENDER_CLASS_TYPE.ENGINE) {
                return parent;
            }
            parent = parent?.getParent();
        }
        return null;
    }

    getLayers() {
        return this._layers;
    }

    getLayer(zIndex: number = 1) {
        for (const layer of this._layers) {
            if (layer.zIndex === zIndex) {
                return layer;
            }
        }
        return this._createDefaultLayer(zIndex);
    }

    getLayerMaxZIndex(): number {
        let maxIndex = Number.MIN_VALUE;
        for (let i = 0; i < this._layers.length; i++) {
            const layer = this._layers[i];
            if (layer.zIndex >= maxIndex) {
                maxIndex = layer.zIndex;
            }
        }
        return maxIndex;
    }

    addLayer(...argument: Layer[]) {
        this._layers.push(...argument);
    }

    // getBackObjects() {
    //     return [...this._ObjectsBack];
    // }

    // getForwardObjects() {
    //     return [...this._ObjectsForward];
    // }

    override addObject(o: BaseObject, zIndex: number = 1) {
        this.getLayer(zIndex)?.addObject(o);
        this._addObject$.next(this);
        return this;
    }

    // addObjectForward(o: BaseObject) {
    //     this._ObjectsForward.push(o);
    //     this._setObjectBehavior(o);
    //     return this;
    // }

    // addObjectBack(o: BaseObject) {
    //     this._ObjectsBack.push(o);
    //     this._setObjectBehavior(o);
    //     return this;
    // }

    override setObjectBehavior(o: BaseObject) {
        if (!o.parent) {
            o.parent = this;
        }
        this.onTransformChangeObservable.add((state: ITransformChangeState) => {
            o.scaleCacheCanvas();
        });
        o.onIsAddedToParentObserver.notifyObservers(this);
    }

    override addObjects(objects: BaseObject[], zIndex: number = 1) {
        this.getLayer(zIndex)?.addObjects(objects);
        this._addObject$.next(this);
        return this;
    }

    removeObject(object?: BaseObject | string) {
        if (object == null) {
            return;
        }
        const layers = this.getLayers();
        for (const layer of layers) {
            layer.removeObject(object);
        }
        return this;
    }

    removeObjects(objects?: BaseObject[] | string[]) {
        if (objects == null) {
            return;
        }
        const layers = this.getLayers();
        for (const layer of layers) {
            layer.removeObjects(objects);
        }
        return this;
    }

    // addBackObjects(...argument: BaseObject[]) {
    //     argument.forEach((o: BaseObject) => {
    //         this.addObjectBack(o);
    //     });
    //     return this;
    // }

    // addForwardObjects(...argument: BaseObject[]) {
    //     argument.forEach((o: BaseObject) => {
    //         this.addObjectForward(o);
    //     });
    //     return this;
    // }

    getAllObjects() {
        const objects: BaseObject[] = [];
        this._layers.sort(sortRules);
        for (const layer of this._layers) {
            objects.push(...layer.getObjectsByOrder());
        }
        return objects;
    }

    getAllObjectsByOrder(isDesc: boolean = false) {
        const objects: BaseObject[] = [];
        const useSortRules = isDesc ? sortRulesByDesc : sortRules;
        this._layers.sort(useSortRules);
        for (const layer of this._layers) {
            objects.push(...layer.getObjectsByOrder().sort(useSortRules));
        }
        return objects;
    }

    getAllObjectsByOrderForPick(isDesc: boolean = false) {
        const objects: BaseObject[] = [];
        const useSortRules = isDesc ? sortRulesByDesc : sortRules;
        this._layers.sort(useSortRules);
        for (const layer of this._layers) {
            objects.push(...layer.getObjectsByOrderForPick().sort(useSortRules));
        }
        return objects;
    }

    override getObject(oKey: string) {
        for (const layer of this._layers) {
            const objects = layer.getObjectsByOrder();
            for (const object of objects) {
                if (object.oKey === oKey) {
                    return object;
                }
            }
        }
    }

    fuzzyMathObjects(oKey: string) {
        const objects: BaseObject[] = [];
        for (const layer of this._layers) {
            const objects = layer.getObjectsByOrder();
            for (const object of objects) {
                if (object.oKey.indexOf(oKey) > -1) {
                    objects.push(object);
                }
            }
        }

        return objects;
    }

    addViewport(...viewport: Viewport[]) {
        this._viewports.push(...viewport);
        return this;
    }

    override removeViewport(key: string) {
        for (let i = 0, len = this._viewports.length; i < len; i++) {
            const viewport = this._viewports[i];
            if (viewport.viewPortKey === key) {
                this._viewports.splice(i, 1);
                return viewport;
            }
        }
    }

    override getViewports() {
        return this._viewports;
    }

    getViewport(key: string) {
        for (const viewport of this._viewports) {
            if (viewport.viewPortKey === key) {
                return viewport;
            }
        }
    }

    changeObjectOrder() {}

    override renderObjects(ctx: CanvasRenderingContext2D, bounds?: IBoundRect) {
        this.getAllObjectsByOrder().forEach((o) => {
            o.render(ctx, bounds);
        });
        return this;
    }

    override render(parentCtx?: CanvasRenderingContext2D) {
        if (!this.isDirty()) {
            return;
        }
        !parentCtx && this.getEngine()?.clearCanvas();

        this._layers.sort(sortRules).forEach((layer) => {
            layer.render(parentCtx);
        });
        // this.getViewports()?.forEach((vp: Viewport) => vp.render(parentCtx));
    }

    async requestRender(parentCtx?: CanvasRenderingContext2D) {
        return new Promise((resolve, reject) => {
            this.render(parentCtx);
            requestNewFrame(resolve);
        });
    }

    openTransformer(config?: ITransformerConfig) {
        if (!this._transformer) {
            this._transformer = new Transformer(this, config);
        }
        this._transformerOpenState = true;
    }

    closeTransformer(isDestroyed = false) {
        if (isDestroyed) {
            this._transformer = null;
        }

        this._transformerOpenState = false;
    }

    override applyTransformer(o: BaseObject) {
        if (!this._transformerOpenState) {
            return;
        }

        this._transformer?.attachTo(o);
    }

    getTransformer() {
        return this._transformer;
    }

    getActiveViewportByRelativeCoord(coord: Vector2) {
        return this._viewports.find((vp) => vp.isHit(coord));
    }

    getActiveViewportByCoord(coord: Vector2) {
        // let parent: any = this.getParent();
        // while (parent) {
        //     if (parent.classType === RENDER_CLASS_TYPE.SCENE_VIEWER) {
        //         const sv = parent as SceneViewer;
        //         const transform = sv.transform.clone().invert();
        //         coord = transform.applyPoint(coord);
        //     }
        //     parent = parent?.getParent && parent?.getParent();
        // }

        coord = this.getRelativeCoord(coord);

        return this.getActiveViewportByRelativeCoord(coord);
    }

    getScrollXYByRelativeCoords(coord: Vector2, viewPort?: Viewport) {
        if (!viewPort) {
            viewPort = this.getActiveViewportByRelativeCoord(coord);
        }
        if (!viewPort) {
            return {
                x: 0,
                y: 0,
            };
        }
        return this.getScrollXY(viewPort);
    }

    getScrollXY(viewPort: Viewport) {
        let x = 0;
        let y = 0;
        if (viewPort) {
            const actualX = viewPort.actualScrollX || 0;
            const actualY = viewPort.actualScrollY || 0;
            x += actualX;
            y += actualY;
        }
        return {
            x,
            y,
        };
    }

    /**
     * In a nested scene scenario, it is necessary to obtain the relative offsets layer by layer.
     * @param coord Coordinates to be converted.
     * @returns
     */
    getRelativeCoord(coord: Vector2) {
        let parent: any = this.getParent();

        const parentList: any[] = [];

        while (parent) {
            if (parent.classType === RENDER_CLASS_TYPE.SCENE || parent.classType === RENDER_CLASS_TYPE.SCENE_VIEWER) {
                parentList.push(parent);
            }
            parent = parent?.getParent && parent?.getParent();
        }

        parentList.reverse();

        for (const parent of parentList) {
            if (parent.classType === RENDER_CLASS_TYPE.SCENE) {
                const scene = parent as Scene;
                const viewPort = scene.getActiveViewportByCoord(coord);
                if (viewPort) {
                    const actualX = viewPort.actualScrollX || 0;
                    const actualY = viewPort.actualScrollY || 0;
                    coord = coord.addByPoint(actualX, actualY);
                }
            } else if (parent.classType === RENDER_CLASS_TYPE.SCENE_VIEWER) {
                const sv = parent as SceneViewer;
                const transform = sv.transform.clone().invert();
                coord = transform.applyPoint(coord);
            }
        }

        return coord;
    }

    // transformToSceneCoord(coord: Vector2) {
    //     const pickedViewport = this.getActiveViewportByCoord(coord);
    //     return pickedViewport?.getRelativeVector(coord);
    // }

    clearLayer() {
        this._layers = [];
    }

    clearViewports() {
        this._viewports = [];
    }

    getAncestorScale() {
        let { scaleX = 1, scaleY = 1 } = this;

        if (this.classType === RENDER_CLASS_TYPE.SCENE_VIEWER) {
            scaleX = this.ancestorScaleX || 1;
            scaleY = this.ancestorScaleY || 1;
        }

        return {
            scaleX,
            scaleY,
        };
    }

    override dispose() {
        this.getLayers().forEach((layer) => {
            layer.dispose();
        });

        this.getViewports().forEach((viewport) => {
            viewport.dispose();
        });

        this.clearLayer();
        this.clearViewports();
        this.detachControl();
        this._transformer?.dispose();
        this.onPointerDownObserver.clear();
        this.onPointerMoveObserver.clear();
        this.onPointerUpObserver.clear();
        this.onPointerEnterObserver.clear();
        this.onPointerLeaveObserver.clear();
        this.onDblclickObserver.clear();
        this.onTripleClickObserver.clear();
        this.onMouseWheelObserver.clear();
        this.onKeyDownObservable.clear();
        this.onKeyUpObservable.clear();
    }

    // Determine the only object selected
    override pick(coord: Vector2): Nullable<BaseObject | Scene | ThinScene> {
        let pickedViewport = this.getActiveViewportByCoord(coord);

        if (!pickedViewport) {
            pickedViewport = this._viewports[0];
        }

        if (!this.evented || !pickedViewport) {
            return;
        }

        const scrollBarRect = pickedViewport.pickScrollBar(coord);
        if (scrollBarRect) {
            return scrollBarRect;
        }

        const svCoordOrigin = pickedViewport.getRelativeVector(coord);

        let isPickedObject: Nullable<BaseObject | Scene | ThinScene> = null;

        const objectOrder = this.getAllObjectsByOrderForPick().reverse();
        const objectLength = objectOrder.length;

        for (let i = 0; i < objectLength; i++) {
            const o = objectOrder[i];
            if (!o.visible || !o.evented || o.classType === RENDER_CLASS_TYPE.GROUP) {
                continue;
            }
            let svCoord = svCoordOrigin;
            if (o.isInGroup && o.parent.classType === RENDER_CLASS_TYPE.GROUP) {
                const { cumLeft, cumTop } = this._getGroupCumLeftRight(o);
                svCoord = svCoord.clone().add(Vector2.FromArray([-cumLeft, -cumTop]));
            }

            if (o.isHit(svCoord)) {
                if (o.classType === RENDER_CLASS_TYPE.SCENE_VIEWER) {
                    const pickedObject = (o as SceneViewer).pick(svCoord);
                    if (pickedObject) {
                        isPickedObject = pickedObject;
                    } else {
                        isPickedObject = (o as SceneViewer).getActiveSubScene();
                    }
                } else {
                    isPickedObject = o;
                }
                break;
            } else if (
                o.classType === RENDER_CLASS_TYPE.SCENE_VIEWER &&
                (o as SceneViewer).allowSelectedClipElement()
            ) {
                const pickedObject = (o as SceneViewer).pick(svCoord);
                if (pickedObject) {
                    isPickedObject = pickedObject;
                    break;
                }
            }
        }

        if (!isPickedObject && this._parent.classType === RENDER_CLASS_TYPE.ENGINE) {
            return this;
        }

        return isPickedObject;
    }

    override triggerKeyDown(evt: IKeyboardEvent) {
        this.onKeyDownObservable.notifyObservers(evt);
        // if (this._parent instanceof SceneViewer) {
        //     this._parent?.triggerKeyDown(evt);
        // }
    }

    override triggerKeyUp(evt: IKeyboardEvent) {
        this.onKeyUpObservable.notifyObservers(evt);
        // if (this._parent instanceof SceneViewer) {
        //     this._parent?.triggerKeyUp(evt);
        // }
    }

    override triggerPointerUp(evt: IPointerEvent | IMouseEvent) {
        if (
            !this.onPointerUpObserver.notifyObservers(evt)?.stopPropagation &&
            this._parent.classType === RENDER_CLASS_TYPE.SCENE_VIEWER
        ) {
            (this._parent as SceneViewer)?.triggerPointerUp(evt);
            return false;
        }
        return true;
    }

    override triggerMouseWheel(evt: IWheelEvent) {
        if (
            !this.onMouseWheelObserver.notifyObservers(evt)?.stopPropagation &&
            this._parent.classType === RENDER_CLASS_TYPE.SCENE_VIEWER
        ) {
            (this._parent as SceneViewer)?.triggerMouseWheel(evt);
            return false;
        }
        return true;
    }

    override triggerPointerMove(evt: IPointerEvent | IMouseEvent) {
        if (
            !this.onPointerMoveObserver.notifyObservers(evt)?.stopPropagation &&
            this._parent.classType === RENDER_CLASS_TYPE.SCENE_VIEWER
        ) {
            (this._parent as SceneViewer)?.triggerPointerMove(evt);
            return false;
        }
        return true;
    }

    override triggerDblclick(evt: IPointerEvent | IMouseEvent) {
        if (
            !this.onDblclickObserver.notifyObservers(evt)?.stopPropagation &&
            this._parent.classType === RENDER_CLASS_TYPE.SCENE_VIEWER
        ) {
            (this._parent as SceneViewer)?.triggerDblclick(evt);
            return false;
        }
        return true;
    }

    override triggerTripleClick(evt: IPointerEvent | IMouseEvent) {
        if (
            !this.onTripleClickObserver.notifyObservers(evt)?.stopPropagation &&
            this._parent.classType === RENDER_CLASS_TYPE.SCENE_VIEWER
        ) {
            (this._parent as SceneViewer)?.triggerTripleClick(evt);
            return false;
        }
        return true;
    }

    override triggerPointerDown(evt: IPointerEvent | IMouseEvent) {
        if (
            !this.onPointerDownObserver.notifyObservers(evt)?.stopPropagation &&
            this._parent.classType === RENDER_CLASS_TYPE.SCENE_VIEWER
        ) {
            (this._parent as SceneViewer)?.triggerPointerDown(evt);
            return false;
        }

        return true;
    }

    override triggerPointerOut(evt: IPointerEvent | IMouseEvent) {
        // this.onPointerOutObserver.notifyObservers(evt);
        if (this._parent.classType === RENDER_CLASS_TYPE.SCENE_VIEWER) {
            (this._parent as SceneViewer)?.triggerPointerOut(evt);
            return false;
        }
        return true;
    }

    override triggerPointerLeave(evt: IPointerEvent | IMouseEvent) {
        // this.onPointerLeaveObserver.notifyObservers(evt);
        if (
            !this.onPointerLeaveObserver.notifyObservers(evt)?.stopPropagation &&
            this._parent.classType === RENDER_CLASS_TYPE.SCENE_VIEWER
        ) {
            (this._parent as SceneViewer)?.triggerPointerLeave(evt);
            return false;
        }
        return true;
    }

    override triggerPointerOver(evt: IPointerEvent | IMouseEvent) {
        // this.onPointerOverObserver.notifyObservers(evt);
        if (this._parent.classType === RENDER_CLASS_TYPE.SCENE_VIEWER) {
            (this._parent as SceneViewer)?.triggerPointerOver(evt);
            return false;
        }
        return true;
    }

    override triggerPointerEnter(evt: IPointerEvent | IMouseEvent) {
        // this.onPointerEnterObserver.notifyObservers(evt);
        if (
            !this.onPointerEnterObserver.notifyObservers(evt)?.stopPropagation &&
            this._parent.classType === RENDER_CLASS_TYPE.SCENE_VIEWER
        ) {
            (this._parent as SceneViewer)?.triggerPointerEnter(evt);
            return false;
        }
        return true;
    }

    private _createDefaultLayer(zIndex: number = 1) {
        const defaultLayer = Layer.create(this, [], zIndex);
        this.addLayer(defaultLayer);
        return defaultLayer;
    }

    private _setTransForm() {
        const composeResult = Transform.create().composeMatrix({
            scaleX: this.scaleX,
            scaleY: this.scaleY,
        });

        this.transform = composeResult;
        this.getViewports().forEach((vp: Viewport) => {
            vp.resetSizeAndScrollBar();
        });
        this.makeDirty(true);
    }

    private _getGroupCumLeftRight(object: BaseObject) {
        let parent: any = object.parent;
        let cumLeft = 0;
        let cumTop = 0;
        while (parent.classType === RENDER_CLASS_TYPE.GROUP) {
            const { left, top } = parent;
            cumLeft += left;
            cumTop += top;

            parent = parent.parent;
        }
        return { cumLeft, cumTop };
    }
}
