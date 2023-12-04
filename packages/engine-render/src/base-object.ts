import type { EventState, IKeyValue, Nullable, Observer } from '@univerjs/core';
import { Observable } from '@univerjs/core';

import type { EVENT_TYPE } from './basics/const';
import { CURSOR_TYPE, RENDER_CLASS_TYPE } from './basics/const';
import type { IMouseEvent, IPointerEvent, IWheelEvent } from './basics/i-events';
import type { IObjectFullState, ITransformChangeState } from './basics/interfaces';
import { TRANSFORM_CHANGE_OBSERVABLE_TYPE } from './basics/interfaces';
import { generateRandomKey, toPx } from './basics/tools';
import { Transform } from './basics/transform';
import type { IBoundRect, Vector2 } from './basics/vector2';

export const BASE_OBJECT_ARRAY = [
    'top',
    'left',
    'width',
    'height',
    'angle',
    'scaleX',
    'scaleY',
    'skewX',
    'skewY',
    'flipX',
    'flipY',
    'strokeWidth',
];

export abstract class BaseObject {
    groupKey?: string;

    isInGroup: boolean = false;

    onTransformChangeObservable = new Observable<ITransformChangeState>();

    onPointerDownObserver = new Observable<IPointerEvent | IMouseEvent>();

    onPointerMoveObserver = new Observable<IPointerEvent | IMouseEvent>();

    onPointerUpObserver = new Observable<IPointerEvent | IMouseEvent>();

    onDblclickObserver = new Observable<IPointerEvent | IMouseEvent>();

    onTripleClickObserver = new Observable<IPointerEvent | IMouseEvent>();

    onMouseWheelObserver = new Observable<IWheelEvent>();
    // onKeyDownObservable = new Observable<IKeyboardEvent>();
    // onKeyUpObservable = new Observable<IKeyboardEvent>();

    onPointerOutObserver = new Observable<IPointerEvent | IMouseEvent>();

    onPointerLeaveObserver = new Observable<IPointerEvent | IMouseEvent>();

    onPointerOverObserver = new Observable<IPointerEvent | IMouseEvent>();

    onPointerEnterObserver = new Observable<IPointerEvent | IMouseEvent>();

    onIsAddedToParentObserver = new Observable<any>();

    onDisposeObserver = new Observable<BaseObject>();

    protected _oKey: string;

    protected _dirty: boolean = true;

    private _top: number = 0;

    private _topOrigin: number | string = 0;

    private _left: number = 0;

    private _leftOrigin: number | string = 0;

    private _width: number = 0;

    private _widthOrigin: number | string = 0;

    private _height: number = 0;

    private _heightOrigin: number | string = 0;

    private _angle: number = 0;

    private _scaleX: number = 1;

    private _scaleY: number = 1;

    private _skewX: number = 0;

    private _skewY: number = 0;

    private _flipX: boolean = false;

    private _flipY: boolean = false;

    private _strokeWidth: number = 0;

    private _parent: any; // TODO: @DR-Univer. The object must be mounted to a scene or group. 'Any' is used here to avoid circular dependencies. This will be resolved later through dependency injection.

    private _zIndex: number = 0;

    private _evented: boolean = true;

    private _visible: boolean = true;

    private _debounceParentDirty: boolean = true;

    private _transform = new Transform();

    private _cursor: CURSOR_TYPE = CURSOR_TYPE.DEFAULT;

    private _isTransformer = false;

    private _forceRender = false;

    private _layer: any; // TODO: @DR-Univer. Belong to layer

    constructor(key?: string) {
        if (key) {
            this._oKey = key;
        } else {
            this._oKey = generateRandomKey();
        }
    }

    get transform() {
        return this._transform;
    }

    get topOrigin() {
        return this._topOrigin;
    }

    get leftOrigin() {
        return this._leftOrigin;
    }

    get widthOrigin() {
        return this._widthOrigin;
    }

    get heightOrigin() {
        return this._heightOrigin;
    }

    get classType() {
        return RENDER_CLASS_TYPE.BASE_OBJECT;
    }

    get top(): number {
        return this._top;
    }

    get left(): number {
        return this._left;
    }

    get width(): number {
        return this._width;
    }

    get height(): number {
        return this._height;
    }

    get strokeWidth() {
        return this._strokeWidth;
    }

    get angle() {
        return this._angle;
    }

    get scaleX() {
        return this._scaleX;
    }

    get scaleY() {
        return this._scaleY;
    }

    get ancestorScaleX() {
        const pScale: number = this.getParent()?.ancestorScaleX || 1;
        return this.scaleX * pScale;
    }

    get ancestorScaleY() {
        const pScale: number = this.getParent()?.ancestorScaleY || 1;
        return this.scaleY * pScale;
    }

    get skewX() {
        return this._skewX;
    }

    get skewY() {
        return this._skewY;
    }

    get flipX() {
        return this._flipX;
    }

    get flipY() {
        return this._flipY;
    }

    get parent() {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return this._parent;
    }

    get oKey() {
        return this._oKey;
    }

    get zIndex() {
        return this._zIndex;
    }

    get evented() {
        return this._evented;
    }

    get visible() {
        return this._visible;
    }

    get debounceParentDirty() {
        return this._debounceParentDirty;
    }

    get isTransformer() {
        return this._isTransformer;
    }

    get cursor() {
        return this._cursor;
    }

    get layer() {
        return this._layer;
    }

    set transform(trans: Transform) {
        this._transform = trans;
    }

    set zIndex(index: number) {
        this._zIndex = index;
    }

    set parent(o: any) {
        this._parent = o;
    }

    set evented(state: boolean) {
        this._evented = state;
    }

    set debounceParentDirty(state: boolean) {
        this._debounceParentDirty = state;
    }

    set isTransformer(state: boolean) {
        this._isTransformer = state;
    }

    set cursor(val: CURSOR_TYPE) {
        this.setCursor(val);
    }

    set layer(layer: any) {
        this._layer = layer;
    }

    protected set top(num: number | string) {
        this._topOrigin = num;
        this._top = toPx(num, this._parent?.height);
    }

    protected set left(num: number | string) {
        this._leftOrigin = num;
        this._left = toPx(num, this._parent?.width);
    }

    protected set width(num: number | string) {
        this._widthOrigin = num;
        this._width = toPx(num, this._parent?.width);
    }

    protected set height(num: number | string) {
        this._heightOrigin = num;
        this._height = toPx(num, this._parent?.height);
    }

    protected set strokeWidth(width: number) {
        this._strokeWidth = width;
    }

    protected set angle(angle: number) {
        this._angle = angle;
    }

    protected set scaleX(scaleX: number) {
        this._scaleX = scaleX;
    }

    protected set scaleY(scaleY: number) {
        this._scaleY = scaleY;
    }

    protected set skewX(skewX: number) {
        this._skewX = skewX;
    }

    protected set flipY(flipY: boolean) {
        this._flipY = flipY;
    }

    protected set flipX(flipX: boolean) {
        this._flipX = flipX;
    }

    protected set skewY(skewY: number) {
        this._skewY = skewY;
    }

    makeDirty(state: boolean = true) {
        this._dirty = state;

        if (state) {
            // const scene = this.getScene();
            // if (scene == null) {
            //     this._dirty = false;

            //     return;
            // }
            if (this._layer == null) {
                this._dirty = false;
                return;
            }
            window.clearTimeout(this._layer.debounceParentTimeout);
            // To prevent multiple refreshes caused by setting values for multiple object instances at once.
            this._layer.debounceParentTimeout = window.setTimeout(() => {
                this._layer?.makeDirty(state);
            }, 0);
            // this.parent?.makeDirty(state);
        }

        return this;
    }

    makeDirtyNoDebounce(state: boolean = true) {
        this._dirty = state;
        if (state) {
            this._layer?.makeDirty(state);
        }

        return this;
    }

    isDirty(): boolean {
        return this._dirty;
    }

    translate(x?: number | string, y?: number | string) {
        const preTop = this.top;
        if (y !== undefined) {
            this.top = y;
        }

        const preLeft = this.left;
        if (x !== undefined) {
            this.left = x;
        }

        this._setTransForm();

        this.onTransformChangeObservable.notifyObservers({
            type: TRANSFORM_CHANGE_OBSERVABLE_TYPE.translate,
            value: { top: this._top, left: this._left },
            preValue: { top: preTop, left: preLeft },
        });

        return this;
    }

    resize(width?: number | string, height?: number | string) {
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
            value: { width: this._width, height: this._height },
            preValue: { width: preWidth, height: preHeight },
        });

        return this;
    }

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
            value: { scaleX: this._scaleX, scaleY: this._scaleY },
            preValue: { scaleX: preScaleX, scaleY: preScaleY },
        });

        return this;
    }

    skew(skewX?: number, skewY?: number) {
        const preSkewX = skewX;
        if (skewX !== undefined) {
            this.skewX = skewX;
        }

        const preSkewY = skewY;
        if (skewY !== undefined) {
            this.skewY = skewY;
        }

        this._setTransForm();

        this.onTransformChangeObservable.notifyObservers({
            type: TRANSFORM_CHANGE_OBSERVABLE_TYPE.skew,
            value: { skewX: this._skewX, skewY: this._skewY },
            preValue: { skewX: preSkewX, skewY: preSkewY },
        });

        return this;
    }

    flip(flipX?: boolean, flipY?: boolean) {
        const preFlipX = flipX;
        if (flipX !== undefined) {
            this.flipX = flipX;
        }
        const preFlipY = flipY;
        if (flipY !== undefined) {
            this.flipY = flipY;
        }

        this._setTransForm();

        this.onTransformChangeObservable.notifyObservers({
            type: TRANSFORM_CHANGE_OBSERVABLE_TYPE.flip,
            value: { flipX: this._flipX, flipY: this._flipY },
            preValue: { flipX: preFlipX, flipY: preFlipY },
        });

        return this;
    }

    transformByState(option: IObjectFullState) {
        const optionKeys = Object.keys(option);
        const preKeys: IObjectFullState = {};

        if (optionKeys.length === 0) {
            return;
        }

        optionKeys.forEach((pKey) => {
            if (option[pKey as keyof IObjectFullState] !== undefined) {
                preKeys[pKey as keyof IObjectFullState] = this[pKey as keyof BaseObject];
                (this as IKeyValue)[pKey] = option[pKey as keyof IObjectFullState];
            }
        });

        this._setTransForm();

        this.onTransformChangeObservable.notifyObservers({
            type: TRANSFORM_CHANGE_OBSERVABLE_TYPE.all,
            value: option,
            preValue: preKeys,
        });

        return this;
    }

    isRender(bounds?: IBoundRect) {
        if (this._forceRender) {
            return false;
        }
        return bounds && !this.isInGroup;
    }

    getParent() {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return this._parent;
    }

    getState() {
        return {
            left: this.left,
            top: this.top,
            width: this.width,
            height: this.height,
            scaleX: this.scaleX,
            scaleY: this.scaleY,
            angle: this.angle,
            skewX: this.skewX,
            skewY: this.skewY,
            flipX: this.flipX,
            flipY: this.flipY,
        };
    }

    hide() {
        this._visible = false;
        this._makeDirtyMix();
    }

    show() {
        this._visible = true;
        this._makeDirtyMix();
    }

    render(ctx: CanvasRenderingContext2D, bounds?: IBoundRect) {
        /* abstract */
    }

    isHit(coord: Vector2) {
        const oCoord = this._getInverseCoord(coord);
        if (
            oCoord.x >= -this.strokeWidth / 2 &&
            oCoord.x <= this.width + this.strokeWidth / 2 &&
            oCoord.y >= -this.strokeWidth / 2 &&
            oCoord.y <= this.height + this.strokeWidth / 2
        ) {
            return true;
        }
        return false;
    }

    on(eventType: EVENT_TYPE, func: (evt: unknown, state: EventState) => void) {
        const observable = (this as IKeyValue)[`on${eventType}Observer`] as Observable<unknown>;
        const observer = observable.add(func.bind(this));
        return observer;
    }

    off(eventType: EVENT_TYPE, observer: Nullable<Observer<unknown>>) {
        const observable = (this as IKeyValue)[`on${eventType}Observer`] as Observable<unknown>;
        observable.remove(observer);
    }

    clear(eventType: EVENT_TYPE) {
        const observable = (this as IKeyValue)[`on${eventType}Observer`] as Observable<unknown>;
        observable.clear();
    }

    resizeCacheCanvas() {
        /* abstract */
    }

    scaleCacheCanvas() {
        /* abstract */
    }

    triggerPointerMove(evt: IPointerEvent | IMouseEvent) {
        if (!this.onPointerMoveObserver.notifyObservers(evt)?.stopPropagation) {
            this._parent?.triggerPointerMove(evt);
            return false;
        }
        return true;
    }

    triggerPointerDown(evt: IPointerEvent | IMouseEvent) {
        if (!this.onPointerDownObserver.notifyObservers(evt)?.stopPropagation) {
            this._parent?.triggerPointerDown(evt);
            return false;
        }
        return true;
    }

    triggerPointerUp(evt: IPointerEvent | IMouseEvent) {
        if (!this.onPointerUpObserver.notifyObservers(evt)?.stopPropagation) {
            this._parent?.triggerPointerUp(evt);
            return false;
        }
        return true;
    }

    triggerDblclick(evt: IPointerEvent | IMouseEvent) {
        if (!this.onDblclickObserver.notifyObservers(evt)?.stopPropagation) {
            this._parent?.triggerDblclick(evt);

            return false;
        }

        return true;
    }

    triggerTripleClick(evt: IPointerEvent | IMouseEvent) {
        if (!this.onTripleClickObserver.notifyObservers(evt)?.stopPropagation) {
            this._parent?.triggerTripleClick(evt);

            return false;
        }

        return true;
    }

    triggerMouseWheel(evt: IWheelEvent) {
        if (!this.onMouseWheelObserver.notifyObservers(evt)?.stopPropagation) {
            this._parent?.triggerMouseWheel(evt);
            return false;
        }
        return true;
    }

    // triggerKeyDown(evt: IKeyboardEvent) {
    //     // this.onKeyDownObservable.notifyObservers(evt);
    //     this._parent?.triggerKeyDown(evt);
    // }

    // triggerKeyUp(evt: IKeyboardEvent) {
    //     // this.onKeyUpObservable.notifyObservers(evt);
    //     this._parent?.triggerKeyUp(evt);
    // }

    triggerPointerOut(evt: IPointerEvent | IMouseEvent) {
        if (!this.onPointerOutObserver.notifyObservers(evt)?.stopPropagation) {
            this._parent?.triggerPointerOut(evt);
            return false;
        }
        return true;
    }

    triggerPointerLeave(evt: IPointerEvent | IMouseEvent) {
        if (!this.onPointerLeaveObserver.notifyObservers(evt)?.stopPropagation) {
            this._parent?.triggerPointerLeave(evt);
            return false;
        }
        return true;
    }

    triggerPointerOver(evt: IPointerEvent | IMouseEvent) {
        if (!this.onPointerOverObserver.notifyObservers(evt)) {
            this._parent?.triggerPointerOver(evt);
            return false;
        }
        return true;
    }

    triggerPointerEnter(evt: IPointerEvent | IMouseEvent) {
        if (!this.onPointerEnterObserver.notifyObservers(evt)?.stopPropagation) {
            this._parent?.triggerPointerEnter(evt);
            return false;
        }
        return true;
    }

    dispose() {
        this.onPointerDownObserver.clear();
        this.onPointerMoveObserver.clear();
        this.onPointerUpObserver.clear();
        this.onMouseWheelObserver.clear();
        this.onPointerOutObserver.clear();
        this.onPointerLeaveObserver.clear();
        this.onPointerOverObserver.clear();
        this.onPointerEnterObserver.clear();
        this.onDblclickObserver.clear();
        this.onTripleClickObserver.clear();
        this.onIsAddedToParentObserver.clear();

        this.parent?.removeObject(this);

        this.onDisposeObserver.notifyObservers(this);
    }

    toJson() {
        const props: IKeyValue = {};
        BASE_OBJECT_ARRAY.forEach((key) => {
            if (this[key as keyof BaseObject]) {
                props[key] = this[key as keyof BaseObject];
            }
        });

        return props;
    }

    getScene(): any {
        let parent: any = this.parent;

        if (parent == null) {
            return;
        }

        if (parent.classType === RENDER_CLASS_TYPE.SCENE) {
            return parent;
        }

        while (parent) {
            if (parent.classType === RENDER_CLASS_TYPE.SCENE) {
                return parent;
            }
            parent = parent.getParent();
        }
    }

    resetCursor() {
        this.getScene()?.resetCursor();
    }

    setCursor(val: CURSOR_TYPE) {
        this._cursor = val;
        this.getScene()?.setCursor(val);
    }

    getEngine(): any {
        let parent: any = this.getParent();
        while (parent != null) {
            if (parent === RENDER_CLASS_TYPE.ENGINE) {
                return parent;
            }
            parent = parent.getParent();
        }
        return null;
    }

    getObjects(): BaseObject[] {
        return [];
    }

    protected _getInverseCoord(coord: Vector2) {
        return this._transform.clone().invert().applyPoint(coord);
    }

    protected _setTransForm() {
        const composeResult = Transform.create().composeMatrix({
            left: this.left + this.strokeWidth / 2,
            top: this.top + this.strokeWidth / 2,
            scaleX: this.scaleX,
            scaleY: this.scaleY,
            angle: this.angle,
            skewX: this.skewX,
            skewY: this.skewY,
            flipX: this.flipX,
            flipY: this.flipY,
        });
        this.transform = composeResult;
        this._makeDirtyMix();
    }

    private _makeDirtyMix() {
        if (this.debounceParentDirty) {
            this.makeDirty(true);
        } else {
            this.makeDirtyNoDebounce(true);
        }
    }
}
