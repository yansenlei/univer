/**
 * Copyright 2023-present DreamNum Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    BooleanNumber,
    HorizontalAlign,
    LocaleType,
    SheetTypes,
    TextDirection,
    VerticalAlign,
    WrapStrategy,
} from '../enum';
import type { IWorkbookData, IWorksheetData } from '../interfaces';

/**
 * Used as an illegal range array return value
 */
export const DEFAULT_RANGE_ARRAY = {
    sheetId: '',
    range: {
        startRow: -1,
        endRow: -1,
        startColumn: -1,
        endColumn: -1,
    },
};

/**
 * Used as an illegal range return value
 */
export const DEFAULT_RANGE = {
    startRow: -1,
    startColumn: -1,
    endRow: -1,
    endColumn: -1,
};

/**
 * Used as an init selection return value
 */
export const DEFAULT_SELECTION = {
    startRow: 0,
    startColumn: 0,
    endRow: 0,
    endColumn: 0,
};
/**
 * Used as an init cell return value
 */
export const DEFAULT_CELL = {
    row: 0,
    column: 0,
};

/**
 * Used as an init workbook return value
 */
export const DEFAULT_WORKBOOK: IWorkbookData = {
    id: '',
    sheetOrder: [],
    name: '',
    appVersion: '',
    locale: LocaleType.ZH_CN,
    styles: {},
    sheets: {},
    resources: [],
};

export const DEFAULT_WORKSHEET_ROW_COUNT = 1000;

export const DEFAULT_WORKSHEET_COLUMN_COUNT = 20;

export const DEFAULT_WORKSHEET_ROW_HEIGHT = 19;

export const DEFAULT_WORKSHEET_COLUMN_WIDTH = 73;

export const DEFAULT_WORKSHEET_ROW_TITLE_WIDTH = 46;

export const DEFAULT_WORKSHEET_COLUMN_TITLE_HEIGHT = 20;

/**
 * Used as an init worksheet return value
 */
export const DEFAULT_WORKSHEET: IWorksheetData = {
    type: SheetTypes.GRID,
    name: 'Sheet1',
    id: 'sheet-01',
    tabColor: '',
    hidden: BooleanNumber.FALSE,
    rowCount: DEFAULT_WORKSHEET_ROW_COUNT,
    columnCount: DEFAULT_WORKSHEET_COLUMN_COUNT,
    zoomRatio: 1,
    freeze: {
        xSplit: 0,
        ySplit: 0,
        startRow: -1,
        startColumn: -1,
    },
    scrollTop: 0,
    scrollLeft: 0,
    defaultColumnWidth: DEFAULT_WORKSHEET_COLUMN_WIDTH,
    defaultRowHeight: DEFAULT_WORKSHEET_ROW_HEIGHT,
    mergeData: [],
    hideRow: [],
    hideColumn: [],
    cellData: {},
    rowData: {},
    columnData: {},
    status: BooleanNumber.FALSE,
    showGridlines: BooleanNumber.TRUE,
    rowHeader: {
        width: DEFAULT_WORKSHEET_ROW_TITLE_WIDTH,
        hidden: BooleanNumber.FALSE,
    },
    columnHeader: {
        height: DEFAULT_WORKSHEET_COLUMN_TITLE_HEIGHT,
        hidden: BooleanNumber.FALSE,
    },
    selections: ['A1'],
    rightToLeft: BooleanNumber.FALSE,
    pluginMeta: {},
};
/**
 * Default styles
 */
export const DEFAULT_STYLES = {
    /**
     * fontFamily
     */
    ff: 'Times New Roman',
    /**
     * fontSize
     */
    fs: 14,
    /**
     * italic
     * 0: false
     * 1: true
     */
    it: BooleanNumber.FALSE,
    /**
     * bold
     * 0: false
     * 1: true
     */
    bl: BooleanNumber.FALSE,
    /**
     * underline
     */
    ul: {
        s: BooleanNumber.FALSE,
    },
    /**
     * strikethrough
     */
    st: {
        s: BooleanNumber.FALSE,
    },
    /**
     * overline
     */
    ol: {
        s: BooleanNumber.FALSE,
    },
    /**
     * textRotation
     */
    tr: {
        a: 0,
        /**
         * true : 1
         * false : 0
         */
        v: BooleanNumber.FALSE,
    },
    /** *
     * textDirection
     */
    td: TextDirection.UNSPECIFIED,
    /**
     * color
     */
    cl: {
        rgb: '#000',
    },
    /**
     * background
     */
    bg: {
        rgb: '#fff',
    },
    /**
     * horizontalAlignment
     */
    ht: HorizontalAlign.UNSPECIFIED,
    /**
     * verticalAlignment
     */
    vt: VerticalAlign.UNSPECIFIED,
    /**
     * wrapStrategy
     */
    tb: WrapStrategy.UNSPECIFIED,
    /**
     * padding
     */
    pd: {
        t: 0,
        r: 0,
        b: 0,
        l: 0,
    },
};

export const DEFAULT_SLIDE = {
    id: 'default_slide',
    title: 'defaultSlide',
    pageSize: {
        width: 300,
        height: 300,
    },
};
