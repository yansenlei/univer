import type { Nullable } from '@univerjs/core';
import { sortRules } from '@univerjs/core';

import { BaseObject } from './base-object';
import { RENDER_CLASS_TYPE } from './basics/const';
import { Canvas } from './canvas';
import type { ThinScene } from './thin-scene';

export class Layer {
    private _objects: BaseObject[] = [];

    private _allowCache: boolean = true;

    private _cacheCanvas: Nullable<Canvas>;

    protected _dirty: boolean = true;

    constructor(
        private _scene: ThinScene,
        objects: BaseObject[] = [],
        private _zIndex: number = 1
    ) {
        this.addObjects(objects);

        if (this._allowCache) {
            this._cacheCanvas = new Canvas();
            this._scene.getEngine().onTransformChangeObservable.add(() => {
                this._resizeCacheCanvas();
            });
        }
    }

    get scene() {
        return this._scene;
    }

    get zIndex() {
        return this._zIndex;
    }

    static create(scene: ThinScene, objects: BaseObject[] = [], zIndex: number = 1000) {
        return new this(scene, objects, zIndex);
    }

    getObjectsByOrder() {
        const objects: BaseObject[] = [];
        this._objects.sort(sortRules);
        for (const o of this._objects) {
            if (!o.isInGroup && o.visible) {
                objects.push(o);
            }
        }
        return objects;
    }

    getObjectsByOrderForPick() {
        const objects: BaseObject[] = [];
        this._objects.sort(sortRules);
        for (const o of this._objects) {
            if (!(o.classType === RENDER_CLASS_TYPE.GROUP) && o.visible) {
                objects.push(o);
            }
        }
        return objects;
    }

    getObjects() {
        return this._objects;
    }

    addObject(o: BaseObject) {
        if (o.classType === RENDER_CLASS_TYPE.GROUP) {
            const objects = (o as BaseObject).getObjects();
            for (const object of objects) {
                if (this.scene.getObject(object.oKey)) {
                    continue;
                }
                this._objects.push(object);
                this.scene.setObjectBehavior(object);
            }
        }
        this._objects.push(o);
        this.scene.setObjectBehavior(o);
        this.scene.applyTransformer(o);
        o.layer = this;

        return this;
    }

    removeObject(object: BaseObject | string) {
        const objects = this.getObjects();
        const objectsLength = objects.length;

        if (object instanceof BaseObject) {
            for (let i = 0; i < objectsLength; i++) {
                const o = objects[i];
                if (o === object) {
                    objects.splice(i, 1);
                    return;
                }
            }
        } else {
            for (let i = 0; i < objectsLength; i++) {
                const o = objects[i];
                if (o.oKey === object) {
                    objects.splice(i, 1);
                    return;
                }
            }
        }
    }

    addObjects(objects: BaseObject[]) {
        objects.forEach((o: BaseObject) => {
            this.addObject(o);
        });
        return this;
    }

    removeObjects(objects: BaseObject[] | string[]) {
        const allObjects = this.getObjects();
        const allObjectsLength = allObjects.length;

        for (let i = allObjectsLength - 1; i >= 0; i--) {
            let o: BaseObject | string = allObjects[i];
            const objectsLength = objects.length;

            if (objectsLength === 0) break;

            for (let j = 0; j < objectsLength; j++) {
                const object = objects[j];
                o = object instanceof BaseObject ? o : (o as BaseObject).oKey;
                if (o === object) {
                    allObjects.splice(i, 1);
                    // objects.splice(j, 1);
                    break;
                }
            }
        }
    }

    makeDirty(state: boolean = true) {
        this._dirty = state;

        return this;
    }

    isDirty(): boolean {
        return this._dirty;
    }

    render(parentCtx?: CanvasRenderingContext2D) {
        const mainCtx = parentCtx || this._scene.getEngine()?.getCanvas().getContext();

        if (this._allowCache && this._cacheCanvas) {
            if (this.isDirty()) {
                const ctx = this._cacheCanvas.getContext();

                this._cacheCanvas.clear();
                ctx.save();

                ctx.setTransform(mainCtx.getTransform());
                this._draw(ctx);

                ctx.restore();
            }
            this._applyCache(mainCtx);
        } else {
            mainCtx.save();
            this._draw(mainCtx);
            mainCtx.restore();
        }

        this.makeDirty(false);
        return this;
    }

    private _draw(mainCtx: CanvasRenderingContext2D) {
        this._scene.getViewports()?.forEach((vp) => vp.render(mainCtx, this.getObjectsByOrder()));
    }

    private _applyCache(ctx?: CanvasRenderingContext2D) {
        if (!ctx || this._cacheCanvas == null) {
            return;
        }
        const pixelRatio = this._cacheCanvas.getPixelRatio();
        const width = this._cacheCanvas.getWidth() * pixelRatio;
        const height = this._cacheCanvas.getHeight() * pixelRatio;
        ctx.drawImage(this._cacheCanvas.getCanvasEle(), 0, 0, width, height);
    }

    private _resizeCacheCanvas() {
        const engine = this._scene.getEngine();
        this._cacheCanvas?.setSize(engine.width, engine.height);
        this.makeDirty(true);
    }

    clear() {
        this._objects = [];
    }

    dispose() {
        this.getObjects().forEach((o) => {
            o.dispose();
        });
        this.clear();

        this._cacheCanvas?.dispose();
    }
}
