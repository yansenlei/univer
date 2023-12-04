import type { IKeyValue, IScale, Nullable } from '@univerjs/core';

import { BASE_OBJECT_ARRAY, BaseObject } from '../base-object';
import { SHAPE_TYPE } from '../basics/const';
import type { IObjectFullState } from '../basics/interfaces';
import { transformBoundingCoord } from '../basics/position';
import type { IBoundRect, Vector2 } from '../basics/vector2';

export type LineJoin = 'round' | 'bevel' | 'miter';
export type LineCap = 'butt' | 'round' | 'square';
export type PaintFirst = 'fill' | 'stroke';

export interface IShapeProps extends IObjectFullState {
    hoverCursor?: Nullable<string>;
    moveCursor?: string | null;
    fillRule?: string;
    globalCompositeOperation?: string;
    evented?: boolean;
    visible?: boolean;
    allowCache?: boolean;
    paintFirst?: PaintFirst;

    stroke?: Nullable<string | CanvasGradient>;
    strokeScaleEnabled?: boolean; // strokeUniform: boolean;
    fill?: Nullable<string | CanvasGradient>;
    fillAfterStrokeEnabled?: boolean;
    hitStrokeWidth?: number | string;
    strokeLineJoin?: LineJoin;
    strokeLineCap?: LineCap;
    shadowColor?: Nullable<string>;
    shadowBlur?: number;
    shadowOffset?: Nullable<Vector2>;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    shadowOpacity?: number;
    shadowEnabled?: boolean;
    shadowForStrokeEnabled?: boolean;
    strokeDashArray?: Nullable<number[]>;
    strokeDashOffset?: number;
    strokeMiterLimit?: number;
    strokeWidth?: number;

    parent?: IScale;
}

export const SHAPE_OBJECT_ARRAY = [
    'hoverCursor',
    'moveCursor',
    'fillRule',
    'globalCompositeOperation',
    'allowCache',
    'paintFirst',
    'stroke',
    'strokeScaleEnabled',
    'fill',
    'fillAfterStrokeEnabled',
    'hitStrokeWidth',
    'strokeLineJoin',
    'strokeLineCap',
    'shadowColor',
    'shadowBlur',
    'shadowOffset',
    'shadowOffsetX',
    'shadowOffsetY',
    'shadowOpacity',
    'shadowEnabled',
    'shadowForStrokeEnabled',
    'strokeDashArray',
    'strokeDashOffset',
    'strokeMiterLimit',
];

export abstract class Shape<T> extends BaseObject {
    private _hoverCursor: Nullable<string>;

    private _moveCursor: string | null = null;

    private _fillRule: string = 'nonzero';

    private _globalCompositeOperation: string = 'source-over';

    private _paintFirst: PaintFirst = 'fill';

    private _stroke: Nullable<string | CanvasGradient>;

    private _strokeScaleEnabled: boolean = false; // strokeUniform: boolean;

    private _fill: Nullable<string | CanvasGradient>;

    private _fillAfterStrokeEnabled: boolean = false;

    private _hitStrokeWidth: number | string = 0;

    private _strokeLineJoin: LineJoin = 'round';

    private _strokeLineCap: LineCap = 'round';

    private _shadowColor: Nullable<string>;

    private _shadowBlur: number = 0;

    private _shadowOffset: Nullable<Vector2>;

    private _shadowOffsetX: number = 0;

    private _shadowOffsetY: number = 0;

    private _shadowOpacity: number = 0;

    private _shadowEnabled: boolean = false;

    private _shadowForStrokeEnabled: boolean = false;

    private _strokeDashArray: Nullable<number[]>;

    private _strokeDashOffset: number = 0;

    private _strokeMiterLimit: number = 0;

    private _type: SHAPE_TYPE = SHAPE_TYPE.RECT;

    constructor(key?: string, props?: T) {
        super(key);

        this._initialProps(props);
    }

    get hoverCursor() {
        return this._hoverCursor;
    }

    get moveCursor() {
        return this._moveCursor;
    }

    get fillRule() {
        return this._fillRule;
    }

    get globalCompositeOperation() {
        return this._globalCompositeOperation;
    }

    get paintFirst() {
        return this._paintFirst;
    }

    get stroke() {
        return this._stroke;
    }

    get strokeScaleEnabled() {
        return this._strokeScaleEnabled;
    }

    get fill() {
        return this._fill;
    }

    get fillAfterStrokeEnabled() {
        return this._fillAfterStrokeEnabled;
    }

    get hitStrokeWidth() {
        return this._hitStrokeWidth;
    }

    get strokeLineJoin() {
        return this._strokeLineJoin;
    }

    get strokeLineCap() {
        return this._strokeLineCap;
    }

    get shadowColor() {
        return this._shadowColor;
    }

    get shadowBlur() {
        return this._shadowBlur;
    }

    get shadowOffset() {
        return this._shadowOffset;
    }

    get shadowOffsetX() {
        return this._shadowOffsetX;
    }

    get shadowOffsetY() {
        return this._shadowOffsetY;
    }

    get shadowOpacity() {
        return this._shadowOpacity;
    }

    get shadowEnabled() {
        return this._shadowEnabled;
    }

    get shadowForStrokeEnabled() {
        return this._shadowForStrokeEnabled;
    }

    get strokeDashArray() {
        return this._strokeDashArray;
    }

    get strokeDashOffset() {
        return this._strokeDashOffset;
    }

    get strokeMiterLimit() {
        return this._strokeMiterLimit;
    }

    static drawWith(ctx: CanvasRenderingContext2D, props: IShapeProps) {
        /** abstract */
    }

    protected static _renderPaintInOrder(ctx: CanvasRenderingContext2D, props: IShapeProps) {
        if (props.paintFirst === 'stroke') {
            this._renderStroke(ctx, props);
            this._renderFill(ctx, props);
        } else {
            this._renderFill(ctx, props);
            this._renderStroke(ctx, props);
        }
    }

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx SheetContext to render on
     */
    private static _renderFill(ctx: CanvasRenderingContext2D, props: IShapeProps) {
        if (!props.fill) {
            return;
        }

        ctx.save();
        this.__setFillStyles(ctx, props);
        if (props.fillRule === 'evenodd') {
            ctx.fill('evenodd');
        } else {
            ctx.fill();
        }
        ctx.restore();
    }

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx SheetContext to render on
     */
    private static _renderStroke(ctx: CanvasRenderingContext2D, props: IShapeProps) {
        const { stroke, strokeWidth, shadowEnabled, shadowForStrokeEnabled, strokeScaleEnabled, parent } = props;

        let { scaleX, scaleY } = props;
        if (!stroke || strokeWidth === 0) {
            return;
        }

        if (shadowEnabled && !shadowForStrokeEnabled) {
            this.__removeShadow(ctx);
        }

        ctx.save();
        if (strokeScaleEnabled && parent) {
            const scaling = this.__getObjectScaling();
            ctx.scale(1 / scaling.scaleX, 1 / scaling.scaleY);
        } else if (strokeScaleEnabled) {
            scaleX = scaleX ?? 1;
            scaleY = scaleY ?? 1;
            ctx.scale(1 / scaleX, 1 / scaleY);
        }
        this.__setLineDash(ctx);
        this.__setStrokeStyles(ctx, props);
        ctx.stroke();
        ctx.restore();
    }

    private static __getObjectScaling() {
        return { scaleX: 1, scaleY: 1 };
    }

    private static __removeShadow(ctx: CanvasRenderingContext2D) {}

    private static __setFillStyles(ctx: CanvasRenderingContext2D, props: IShapeProps) {
        ctx.fillStyle = props.fill!;
    }

    private static __setStrokeStyles(ctx: CanvasRenderingContext2D, props: IShapeProps) {
        const { strokeWidth, strokeLineCap, strokeDashOffset, strokeLineJoin, strokeMiterLimit, stroke } = props;
        ctx.lineWidth = strokeWidth!;
        ctx.lineCap = strokeLineCap!;
        ctx.lineDashOffset = strokeDashOffset!;
        ctx.lineJoin = strokeLineJoin!;
        ctx.miterLimit = strokeMiterLimit!;
        ctx.strokeStyle = stroke!;
    }

    private static __setLineDash(ctx: CanvasRenderingContext2D) {}

    override render(mainCtx: CanvasRenderingContext2D, bounds?: IBoundRect) {
        if (!this.visible) {
            this.makeDirty(false);
            return this;
        }

        // Temporarily ignore the on-demand display of elements within a group：this.isInGroup
        if (this.isRender()) {
            const { minX, maxX, minY, maxY } = transformBoundingCoord(this, bounds!);

            if (this.width + this.strokeWidth < minX || maxX < 0 || this.height + this.strokeWidth < minY || maxY < 0) {
                // console.warn('ignore object', this);
                return this;
            }
        }

        const m = this.transform.getMatrix();
        mainCtx.save();
        // eslint-disable-next-line no-magic-numbers
        mainCtx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        this._draw(mainCtx);
        mainCtx.restore();
        this.makeDirty(false);
        return this;
    }

    setProps(props?: T) {
        if (!props) {
            return;
        }

        const themeKeys = Object.keys(props);
        if (themeKeys.length === 0) {
            return;
        }
        themeKeys.forEach((key) => {
            if ((props as IKeyValue)[key] === undefined) {
                return true;
            }

            if (BASE_OBJECT_ARRAY.indexOf(key) === -1) {
                (this as IKeyValue)[`_${key}`] = (props as IKeyValue)[key];
            }
        });
        this.makeDirty(true);
        return this;
    }

    override toJson() {
        const props: IKeyValue = {};
        SHAPE_OBJECT_ARRAY.forEach((key) => {
            if (this[key as keyof Shape<T>]) {
                props[key] = this[key as keyof Shape<T>];
            }
        });
        return {
            ...super.toJson(),
            ...props,
        };
    }

    protected _draw(ctx: CanvasRenderingContext2D) {
        /** abstract */
    }

    private _initialProps(props?: T) {
        if (!props) {
            return;
        }

        const themeKeys = Object.keys(props);
        if (themeKeys.length === 0) {
            return;
        }

        const transformState: IObjectFullState = {};
        let hasTransformState = false;
        themeKeys.forEach((key) => {
            if ((props as IKeyValue)[key] === undefined) {
                return true;
            }

            if (BASE_OBJECT_ARRAY.indexOf(key) > -1) {
                transformState[key as keyof IObjectFullState] = (props as IKeyValue)[key];
                hasTransformState = true;
            } else {
                (this as IKeyValue)[`_${key}`] = (props as IKeyValue)[key];
            }
        });

        if (hasTransformState) {
            this.transformByState(transformState);
        }

        this.makeDirty(true);
    }
}
