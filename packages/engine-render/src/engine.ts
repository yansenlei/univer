import type { Nullable } from '@univerjs/core';
import { Observable, toDisposable } from '@univerjs/core';

import type { CURSOR_TYPE } from './basics/const';
import type { IKeyboardEvent, IPointerEvent } from './basics/i-events';
import { DeviceType, PointerInput } from './basics/i-events';
import { TRANSFORM_CHANGE_OBSERVABLE_TYPE } from './basics/interfaces';
import { PerformanceMonitor } from './basics/performance-monitor';
import { getPointerPrefix, getSizeForDom, IsSafari, requestNewFrame } from './basics/tools';
import { Canvas } from './canvas';
import type { Scene } from './scene';
import { ThinEngine } from './thin-engine';

export class Engine extends ThinEngine<Scene> {
    renderEvenInBackground = true;

    /**
     * Observable raised when the engine begins a new frame
     */
    onBeginFrameObservable = new Observable<Engine>();

    /**
     * Observable raised when the engine ends the current frame
     */
    onEndFrameObservable = new Observable<Engine>();

    private _container: Nullable<HTMLElement>;

    private _canvas: Canvas = new Canvas();

    private _canvasEle!: HTMLCanvasElement;

    private _renderingQueueLaunched = false;

    private _activeRenderLoops = new Array<() => void>();

    private _renderFunction = () => {};

    private _requestNewFrameHandler: number = -1;

    private _frameId: number = -1;

    private _usingSafari: boolean = IsSafari();

    // FPS
    private _fps = 60;

    private _deltaTime = 0;

    private _performanceMonitor = new PerformanceMonitor();

    private _pointerMoveEvent!: (evt: any) => void;

    private _pointerDownEvent!: (evt: any) => void;

    private _pointerUpEvent!: (evt: Event) => void;

    private _pointerBlurEvent!: (evt: any) => void;

    private _pointerWheelEvent!: (evt: any) => void;

    private _pointerEnterEvent!: (evt: any) => void;

    private _pointerLeaveEvent!: (evt: any) => void;

    /** previous pointer position */
    private pointer: { [deviceSlot: number]: number } = {};

    private _mouseId = -1;

    private _isUsingFirefox = navigator.userAgent.indexOf('Firefox') !== -1;

    constructor(elemWidth: number = 100, elemHeight: number = 100) {
        super();
        this._canvasEle = this._canvas.getCanvasEle();
        this._canvas.setSize(elemWidth, elemHeight);
        this._handleKeyboardAction();
        this._handlePointerAction();
    }

    override get width() {
        return this._canvas.getWidth();
    }

    override get height() {
        return this._canvas.getHeight();
    }

    get requestNewFrameHandler() {
        return this._requestNewFrameHandler;
    }

    /**
     * Gets the current frame id
     */
    get frameId(): number {
        return this._frameId;
    }

    override setCanvasCursor(val: CURSOR_TYPE) {
        const canvasEl = this.getCanvas().getCanvasEle();
        canvasEl.style.cursor = val;
    }

    override clearCanvas() {
        this.getCanvas().clear();
    }

    override getCanvas() {
        return this._canvas;
    }

    override getCanvasElement() {
        return this._canvas.getCanvasEle();
    }

    getPixelRatio() {
        return this._canvas.getPixelRatio();
    }

    setContainer(elem: HTMLElement) {
        this._container = elem;
        this._container.appendChild(this._canvasEle);

        this.resize();

        let timer: number | undefined;
        const resizeObserver = new ResizeObserver(() => {
            if (!timer) {
                timer = window.requestIdleCallback(() => {
                    this.resize();
                    timer = undefined;
                });
            }
        });

        resizeObserver.observe(this._container);

        this.disposeWithMe(
            toDisposable(() => {
                resizeObserver.unobserve(this._container as HTMLElement);
            })
        );
    }

    resize() {
        if (!this._container) {
            return;
        }

        const { width, height } = getSizeForDom(this._container);

        this.resizeBySize(width, height);
    }

    resizeBySize(width: number, height: number) {
        const preWidth = this.width;
        const preHeight = this.height;
        this._canvas.setSize(width, height);
        this.onTransformChangeObservable.notifyObservers({
            type: TRANSFORM_CHANGE_OBSERVABLE_TYPE.resize,
            value: {
                width,
                height,
            },
            preValue: {
                width: preWidth,
                height: preHeight,
            },
        });
    }

    override dispose() {
        super.dispose();
        const eventPrefix = getPointerPrefix();
        this._canvasEle.removeEventListener(`${eventPrefix}leave`, this._pointerLeaveEvent);
        this._canvasEle.removeEventListener(`${eventPrefix}enter`, this._pointerEnterEvent);
        this._canvasEle.removeEventListener(`${eventPrefix}move`, this._pointerMoveEvent);
        this._canvasEle.removeEventListener(`${eventPrefix}down`, this._pointerDownEvent);
        this._canvasEle.removeEventListener(`${eventPrefix}up`, this._pointerUpEvent);
        this._canvasEle.removeEventListener('blur', this._pointerBlurEvent);
        this._canvasEle.removeEventListener(this._getWheelEventName(), this._pointerWheelEvent);

        this._activeRenderLoops = [];
        this._canvas.dispose();
        this.onBeginFrameObservable.clear();
        this.onEndFrameObservable.clear();
        this.onTransformChangeObservable.clear();
    }

    /**
     * Register and execute a render loop. The engine can have more than one render function
     * @param renderFunction defines the function to continuously execute
     */
    runRenderLoop(renderFunction: () => void): void {
        if (this._activeRenderLoops.indexOf(renderFunction) !== -1) {
            return;
        }

        this._activeRenderLoops.push(renderFunction);

        if (!this._renderingQueueLaunched) {
            this._renderingQueueLaunched = true;
            this._renderFunction = this._renderLoop.bind(this);
            this._requestNewFrameHandler = requestNewFrame(this._renderFunction);
        }
    }

    /**
     * stop executing a render loop function and remove it from the execution array
     * @param renderFunction defines the function to be removed. If not provided all functions will be removed.
     */
    stopRenderLoop(renderFunction?: () => void): void {
        if (!renderFunction) {
            this._activeRenderLoops.length = 0;
            this._cancelFrame();
            return;
        }

        const index = this._activeRenderLoops.indexOf(renderFunction);

        if (index >= 0) {
            this._activeRenderLoops.splice(index, 1);
            if (this._activeRenderLoops.length === 0) {
                this._cancelFrame();
            }
        }
    }

    /**
     * Begin a new frame
     */
    beginFrame(): void {
        this._measureFps();
        this.onBeginFrameObservable.notifyObservers(this);
    }

    /**
     * End the current frame
     */
    endFrame(): void {
        this._frameId++;
        this.onEndFrameObservable.notifyObservers(this);
    }

    // FPS

    /**
     * Gets the current framerate
     * @returns a number representing the framerate
     */
    getFps(): number {
        return this._fps;
    }

    /**
     * Gets the time spent between current and previous frame
     * @returns a number representing the delta time in ms
     */
    getDeltaTime(): number {
        return this._deltaTime;
    }

    _renderFrame() {
        for (let index = 0; index < this._activeRenderLoops.length; index++) {
            const renderFunction = this._activeRenderLoops[index];

            renderFunction();
        }
    }

    private _cancelFrame() {
        if (this._renderingQueueLaunched && this._requestNewFrameHandler) {
            this._renderingQueueLaunched = false;
            if (typeof window === 'undefined') {
                if (typeof cancelAnimationFrame === 'function') {
                    return cancelAnimationFrame(this._requestNewFrameHandler);
                }
            } else {
                const { cancelAnimationFrame } = this._getHostWindow() || window;
                if (typeof cancelAnimationFrame === 'function') {
                    return cancelAnimationFrame(this._requestNewFrameHandler);
                }
            }
            return clearTimeout(this._requestNewFrameHandler);
        }
    }

    private _getHostWindow(): Nullable<Window> {
        if (typeof window === 'undefined') {
            return null;
        }

        if (this._canvasEle?.ownerDocument?.defaultView) {
            return this._canvasEle.ownerDocument.defaultView;
        }

        return window;
    }

    /** @hidden */
    private _renderLoop(): void {
        let shouldRender = true;
        if (!this.renderEvenInBackground) {
            shouldRender = false;
        }

        if (shouldRender) {
            // Start new frame
            this.beginFrame();
            this._renderFrame();
            // Present
            this.endFrame();
        }

        if (this._activeRenderLoops.length > 0) {
            this._requestNewFrameHandler = requestNewFrame(this._renderFunction);
        } else {
            this._renderingQueueLaunched = false;
        }
    }

    private _measureFps(): void {
        this._performanceMonitor.sampleFrame();
        this._fps = this._performanceMonitor.averageFPS;
        this._deltaTime = this._performanceMonitor.instantaneousFrameTime || 0;
    }

    private _handleKeyboardAction() {
        const keyboardDownEvent = (evt: any) => {
            const deviceEvent = evt as IKeyboardEvent;
            deviceEvent.deviceType = DeviceType.Keyboard;
            deviceEvent.inputIndex = evt.keyCode;
            deviceEvent.previousState = 0;
            deviceEvent.currentState = 1;

            this.onInputChangedObservable.notifyObservers(deviceEvent);
        };

        const keyboardUpEvent = (evt: any) => {
            const deviceEvent = evt as IKeyboardEvent;
            deviceEvent.deviceType = DeviceType.Keyboard;
            deviceEvent.inputIndex = evt.keyCode;
            deviceEvent.previousState = 1;
            deviceEvent.currentState = 0;

            this.onInputChangedObservable.notifyObservers(deviceEvent);
        };

        this._canvasEle.addEventListener('keydown', keyboardDownEvent);
        this._canvasEle.addEventListener('keyup', keyboardUpEvent);
    }

    // eslint-disable-next-line max-lines-per-function
    private _handlePointerAction() {
        const eventPrefix = getPointerPrefix();

        this._pointerMoveEvent = (evt: any) => {
            const deviceType = this._getPointerType(evt);
            // Store previous values for event
            const previousHorizontal = this.pointer[PointerInput.Horizontal];
            const previousVertical = this.pointer[PointerInput.Vertical];
            const previousDeltaHorizontal = this.pointer[PointerInput.DeltaHorizontal];
            const previousDeltaVertical = this.pointer[PointerInput.DeltaVertical];

            this.pointer[PointerInput.Horizontal] = evt.clientX;
            this.pointer[PointerInput.Vertical] = evt.clientY;
            this.pointer[PointerInput.DeltaHorizontal] = evt.movementX;
            this.pointer[PointerInput.DeltaVertical] = evt.movementY;
            // console.log('pointerMoveEvent_1', previousHorizontal, evt.clientX, previousVertical, evt.clientY, this._pointer);
            const deviceEvent = evt as IPointerEvent;
            deviceEvent.deviceType = deviceType;

            if (previousHorizontal !== evt.clientX) {
                deviceEvent.inputIndex = PointerInput.Horizontal;
                deviceEvent.previousState = previousHorizontal;
                deviceEvent.currentState = this.pointer[PointerInput.Horizontal];

                this.onInputChangedObservable.notifyObservers(deviceEvent);
            }
            if (previousVertical !== evt.clientY) {
                deviceEvent.inputIndex = PointerInput.Vertical;
                deviceEvent.previousState = previousVertical;
                deviceEvent.currentState = this.pointer[PointerInput.Vertical];

                this.onInputChangedObservable.notifyObservers(deviceEvent);
            }
            if (this.pointer[PointerInput.DeltaHorizontal] !== 0) {
                deviceEvent.inputIndex = PointerInput.DeltaHorizontal;
                deviceEvent.previousState = previousDeltaHorizontal;
                deviceEvent.currentState = this.pointer[PointerInput.DeltaHorizontal];

                this.onInputChangedObservable.notifyObservers(deviceEvent);
            }
            if (this.pointer[PointerInput.DeltaVertical] !== 0) {
                deviceEvent.inputIndex = PointerInput.DeltaVertical;
                deviceEvent.previousState = previousDeltaVertical;
                deviceEvent.currentState = this.pointer[PointerInput.DeltaVertical];

                this.onInputChangedObservable.notifyObservers(deviceEvent);
            }

            // Lets Propagate the event for move with same position.
            if (!this._usingSafari && evt.button !== -1) {
                deviceEvent.inputIndex = evt.button + 2;
                deviceEvent.previousState = this.pointer[evt.button + 2];
                this.pointer[evt.button + 2] = this.pointer[evt.button + 2] ? 0 : 1; // Reverse state of button if evt.button has value
                deviceEvent.currentState = this.pointer[evt.button + 2];
                this.onInputChangedObservable.notifyObservers(deviceEvent);
            }
        };

        this._pointerDownEvent = (nativeEvent: Event) => {
            const evt = nativeEvent as IPointerEvent;
            // TODO: maybe we should wrap the native event to an CustomEvent

            const deviceType = this._getPointerType(evt);
            const previousHorizontal = this.pointer[PointerInput.Horizontal];
            const previousVertical = this.pointer[PointerInput.Vertical];
            const previousButton = this.pointer[evt.button + 2];

            if (deviceType === DeviceType.Mouse) {
                // Mouse; Among supported browsers, value is either 1 or 0 for mouse
                if (this._mouseId === -1) {
                    if (evt.pointerId === undefined) {
                        // If there is no pointerId (eg. manually dispatched MouseEvent)
                        this._mouseId = this._isUsingFirefox ? 0 : 1;
                    } else {
                        this._mouseId = evt.pointerId;
                    }
                }
                if (!document.pointerLockElement) {
                    this._canvasEle.setPointerCapture(this._mouseId);
                }
            } else {
                // Touch; Since touches are dynamically assigned, only set capture if we have an id
                if (evt.pointerId && !document.pointerLockElement) {
                    this._canvasEle.setPointerCapture(evt.pointerId);
                }
            }

            this.pointer[PointerInput.Horizontal] = evt.clientX;
            this.pointer[PointerInput.Vertical] = evt.clientY;
            this.pointer[evt.button + 2] = 1;

            const deviceEvent = evt as IPointerEvent;
            deviceEvent.deviceType = deviceType;

            if (previousHorizontal !== evt.clientX) {
                deviceEvent.inputIndex = PointerInput.Horizontal;
                deviceEvent.previousState = previousHorizontal;
                deviceEvent.currentState = this.pointer[PointerInput.Horizontal];

                this.onInputChangedObservable.notifyObservers(deviceEvent);
                // console.log('pointerDownEvent_clientX');
            }
            if (previousVertical !== evt.clientY) {
                deviceEvent.inputIndex = PointerInput.Vertical;
                deviceEvent.previousState = previousVertical;
                deviceEvent.currentState = this.pointer[PointerInput.Vertical];

                this.onInputChangedObservable.notifyObservers(deviceEvent);
                // console.log('pointerDownEvent_clientY');
            }

            deviceEvent.inputIndex = evt.button + 2;
            deviceEvent.previousState = previousButton;
            deviceEvent.currentState = this.pointer[evt.button + 2];
            this.onInputChangedObservable.notifyObservers(deviceEvent);
            // console.log('pointerDownEvent_2', previousHorizontal, evt.clientX, previousVertical, evt.clientY, this._pointer);
        };

        this._pointerUpEvent = (_evt: Event) => {
            const evt = _evt as PointerEvent | MouseEvent;

            const deviceType = this._getPointerType(evt);
            const previousHorizontal = this.pointer[PointerInput.Horizontal];
            const previousVertical = this.pointer[PointerInput.Vertical];
            const previousButton = this.pointer[evt.button + 2];

            this.pointer[PointerInput.Horizontal] = evt.clientX;
            this.pointer[PointerInput.Vertical] = evt.clientY;
            this.pointer[evt.button + 2] = 0;

            const deviceEvent = evt as IPointerEvent;
            deviceEvent.deviceType = deviceType;

            if (previousHorizontal !== evt.clientX) {
                deviceEvent.inputIndex = PointerInput.Horizontal;
                deviceEvent.previousState = previousHorizontal;
                deviceEvent.currentState = this.pointer[PointerInput.Horizontal];

                this.onInputChangedObservable.notifyObservers(deviceEvent);
            }
            if (previousVertical !== evt.clientY) {
                deviceEvent.inputIndex = PointerInput.Vertical;
                deviceEvent.previousState = previousVertical;
                deviceEvent.currentState = this.pointer[PointerInput.Vertical];

                this.onInputChangedObservable.notifyObservers(deviceEvent);
            }

            deviceEvent.inputIndex = evt.button + 2;
            deviceEvent.previousState = previousButton;
            deviceEvent.currentState = this.pointer[evt.button + 2];

            if (
                deviceType === DeviceType.Mouse &&
                this._mouseId >= 0 &&
                this._canvasEle.hasPointerCapture(this._mouseId)
            ) {
                this._canvasEle.releasePointerCapture(this._mouseId);
            } else if (deviceEvent.pointerId && this._canvasEle.hasPointerCapture(deviceEvent.pointerId)) {
                this._canvasEle.releasePointerCapture(deviceEvent.pointerId);
            }

            this.onInputChangedObservable.notifyObservers(deviceEvent);

            // We don't want to unregister the mouse because we may miss input data when a mouse is moving after a click
            if (deviceType !== DeviceType.Mouse) {
                this.pointer = {};
            }
        };

        this._pointerEnterEvent = (evt: any) => {
            const deviceType = this._getPointerType(evt);
            // Store previous values for event
            const deviceEvent = evt as IPointerEvent;
            deviceEvent.deviceType = deviceType;

            deviceEvent.currentState = 2;

            this.onInputChangedObservable.notifyObservers(deviceEvent);
        };

        this._pointerLeaveEvent = (evt: any) => {
            const deviceType = this._getPointerType(evt);
            // Store previous values for event
            const deviceEvent = evt as IPointerEvent;
            deviceEvent.deviceType = deviceType;

            deviceEvent.currentState = 3;

            this.onInputChangedObservable.notifyObservers(deviceEvent);
        };

        this._pointerBlurEvent = (evt: any) => {
            if (this._mouseId >= 0 && this._canvasEle.hasPointerCapture(this._mouseId)) {
                this._canvasEle.releasePointerCapture(this._mouseId);
                this._mouseId = -1;
            }

            this.pointer = {};
        };

        this._pointerWheelEvent = (evt: any) => {
            const deviceType = DeviceType.Mouse;
            // Store previous values for event
            const previousWheelScrollX = this.pointer[PointerInput.MouseWheelX];
            const previousWheelScrollY = this.pointer[PointerInput.MouseWheelY];
            const previousWheelScrollZ = this.pointer[PointerInput.MouseWheelZ];

            this.pointer[PointerInput.MouseWheelX] = evt.deltaX || 0;
            this.pointer[PointerInput.MouseWheelY] = evt.deltaY || evt.wheelDelta || 0;
            this.pointer[PointerInput.MouseWheelZ] = evt.deltaZ || 0;

            const deviceEvent = evt as IPointerEvent;
            deviceEvent.deviceType = deviceType;

            if (this.pointer[PointerInput.MouseWheelX] !== 0) {
                deviceEvent.inputIndex = PointerInput.MouseWheelX;
                deviceEvent.previousState = previousWheelScrollX;
                deviceEvent.currentState = this.pointer[PointerInput.MouseWheelX];
                this.onInputChangedObservable.notifyObservers(deviceEvent);
            }
            if (this.pointer[PointerInput.MouseWheelY] !== 0) {
                deviceEvent.inputIndex = PointerInput.MouseWheelY;
                deviceEvent.previousState = previousWheelScrollY;
                deviceEvent.currentState = this.pointer[PointerInput.MouseWheelY];
                this.onInputChangedObservable.notifyObservers(deviceEvent);
            }
            if (this.pointer[PointerInput.MouseWheelZ] !== 0) {
                deviceEvent.inputIndex = PointerInput.MouseWheelZ;
                deviceEvent.previousState = previousWheelScrollZ;
                deviceEvent.currentState = this.pointer[PointerInput.MouseWheelZ];
                this.onInputChangedObservable.notifyObservers(deviceEvent);
            }
        };

        this._canvasEle.addEventListener(`${eventPrefix}enter`, this._pointerEnterEvent);
        this._canvasEle.addEventListener(`${eventPrefix}leave`, this._pointerLeaveEvent);
        this._canvasEle.addEventListener(`${eventPrefix}move`, this._pointerMoveEvent);
        this._canvasEle.addEventListener(`${eventPrefix}down`, this._pointerDownEvent);
        this._canvasEle.addEventListener(`${eventPrefix}up`, this._pointerUpEvent);
        this._canvasEle.addEventListener('blur', this._pointerBlurEvent);
        this._canvasEle.addEventListener(
            this._getWheelEventName(),
            this._pointerWheelEvent,
            this._getPassive() ? { passive: false } : false
        );
    }

    private _getWheelEventName(): string {
        const wheelEventName =
            'onwheel' in document.createElement('div')
                ? 'wheel' // Modern browsers support "wheel"
                : (document as any).onmousewheel !== undefined
                  ? 'mousewheel' // Webkit and IE support at least "mousewheel"
                  : 'DOMMouseScroll'; // let's assume that remaining browsers are older Firefox
        return wheelEventName;
    }

    private _getPassive(): boolean {
        // Code originally in scene.inputManager.ts
        // Chrome reports warning in console if wheel listener doesn't set an explicit passive option.
        // IE11 only supports captureEvent:boolean, not options:object, and it defaults to false.
        // Feature detection technique copied from: https://github.com/github/eventlistener-polyfill (MIT license)
        let passiveSupported = false;
        const noop = () => {};

        try {
            const options: object = {
                passive: {
                    get() {
                        passiveSupported = true;
                    },
                },
            };

            this._canvasEle.addEventListener('test', noop, options);
            this._canvasEle.removeEventListener('test', noop, options);
        } catch (e) {
            /* */
        }

        return passiveSupported;
    }

    private _getPointerType(evt: any): DeviceType {
        let deviceType = DeviceType.Mouse;

        if (evt.pointerType === 'touch' || evt.pointerType === 'pen' || evt.touches) {
            deviceType = DeviceType.Touch;
        }

        return deviceType;
    }
}
