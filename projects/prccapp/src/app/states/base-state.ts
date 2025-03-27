import { Observable, from, forkJoin, tap } from "rxjs";
import { ApiService } from "../api.service";
import { FocusMode } from "./focus-modes";

export type StateMode = 'about' | 'trees' | 'tree' | 'stat-areas' | 'stat-area' | 'munis' | 'muni' | 'empty'|'odot' ;

export type PopupLayerItem = {label: string, content: (f: any) => string};
export type PopupLayers = {[key: string]: PopupLayerItem[]};

export class LayerConfig {
    constructor(public filter: any | null, public paint: any | null, public layout: any | null) {
    }
}

export class Chart {
    constructor(public title: string, public chart: Node) {}
}

export class LegendItem {
    constructor(public color: string, public label: string, public separated=false, public scaled=false, public direction='row', public label_on_color=false) {}
    // change direction to 'row-reverse' if you want label to be to the right of color instead of to the left!
}

export class Legend {
    constructor(public title: string, 
                public items: LegendItem[], 
                public tooltip?: string, 
                public displayTitle = false,
                public opacity : number = 0.6,
                public image? : string
            ) {}
}

export class FilterOption {
    constructor(public value: string, public label: any) {}
};

export class FilterItem {
    label: string;
    placeholder: string = '';
    options: FilterOption[] = [];

    constructor(public id: string, public kind: string) {}
}

export class CheckFilterItem extends FilterItem {
    constructor(id: string, label: string) {
        super(id, 'check');
        this.label = label;
    }
}

export class SelectFilterItem extends FilterItem {
    constructor(id: string, label: string, options: FilterOption[]) {
        super(id, 'select');
        this.label = label;
        this.options = options;
    }
}
export class MultipleSelectFilterItem extends FilterItem {
    constructor(id: string, label: string, placeholder: string, options: FilterOption[]) {
        super(id, 'multi-select');
        this.label = label;
        this.options = options;
        this.placeholder = placeholder;
    }
}


export class State {

    // data: any[][];
    sql: string[] = [];
    downloadQuery: string | null = null;
    geo: {
        zoom: number;
        center: [number, number];
    } | null = null;
    processed = false;
    layerConfig: {[id: string]: LayerConfig} = {};
    charts: Chart[] = [];
    legend: Legend | null = null;
    filterItems: FilterItem[] = [];
    focus: FocusMode|null = null;
    focusQuery: string;
    clearFilters = false;
    popupLayers: PopupLayers = {};

    manual_opacity : number = -1;

    // the filters arg contains the URL part that represents the drop-down selection!
    constructor(public mode: StateMode, public id?: string, public filters: any = {}) {
        if (this.filters.focus) {
            this.focus = FocusMode.fromQueryParam(this.filters.focus) || null;
        } else {
            this.focus = null;
        }
        this.focusQuery = this.focus?.treesQuery() || 'TRUE';
        this.clearFilters = this.filters && Object.keys(this.filters).length > 0;

        // hack: if you manually add "opacity=0.6" or any other value to URL, we use that value for opacity
        //let manual_opacity = -1;
        if (filters["opacity"]) {
            this.manual_opacity = Number(filters["opacity"]);
            if (!(this.manual_opacity > 0 && this.manual_opacity <= 1)) {
                this.manual_opacity = -1;
            }
        }
        
    }
    
    process(api: ApiService): Observable<any> {
        let ret: Observable<any> = from([true]);
        if (this.processed) {
            return ret;
        }
        // if (this.sql.length) {
        //     ret = forkJoin(this.sql.map(sql => api.query(sql))).pipe(
        //         tap((data: any[][]) => {
        //             this.processed = true;
        //             this.data = data;
        //             this.handleData(data);
        //         })
        //     )
        // }
        return ret;
    }

    isLayerVisible(id: string): boolean {
        return !!this.layerConfig[id];
    }

    getLayerConfig(id: string): LayerConfig {
        return this.layerConfig[id];
    }

    handleData(data: any[][]) {
    }

    calculate_paint_definition(coloring: string, opacity : number) {
        const color_step_for_vegetation = [
            'step',
            ['get', 'VegFrac'],
            ['to-color', '#D9D9D9'],
            0.001,
            ['to-color', '#BBDFC3'],
            0.40,
            ['to-color', '#90B192'],
            0.50,
            ['to-color', '#6D8F6E'],
            0.60,
            ['to-color', '#4D734E'],
            0.80,
            ['to-color', '#2B5B34']
        ];

        const color_step_for_temperature = [
            'step',
            ['get', 'Temperatur'],
            ['to-color', '#D9D9D9'],
            30,
            ['to-color', '#F7DEDF'],
            33,
            ['to-color', '#EDB1B2'],
            34,
            ['to-color', '#E58586'],
            35,
            ['to-color', '#DE5959'],
            37,
            ['to-color', '#EC1E26']
        ];

        const color_interpolation_for_cluster = [
                    'match', ['coalesce', ['get', 'cluster17'], 0],
                    0, ['to-color', '#9BD7F5'],
                    1, ['to-color', '#9BD7F5'],
                    2, ['to-color', '#89C8EE'],
                    3, ['to-color', '#78BBE7'],
                    4, ['to-color', '#66AFE1'],
                    5, ['to-color', '#54A4DB'],
                    6, ['to-color', '#497DB0'],
                    7, ['to-color', '#3C5E91'],
                    8, ['to-color', '#314177'],
                    9, ['to-color', '#272361'],
                    ['to-color', '#1E1E4D'],
                ];

        console.log('using opacity ', opacity);
        const paint_definitions_for_temperature = {
            'fill-color': color_step_for_temperature,
            //'fill-color': color_interpolation_for_temperature,
            'fill-opacity': opacity
        };
        const paint_definitions_for_vegetation = {
            'fill-color': color_step_for_vegetation,
            //'fill-color': color_interpolation_for_vegetation,
            'fill-opacity': opacity
        };
        const paint_definitions_for_cluster = {
            'fill-color': color_interpolation_for_cluster,
            'fill-opacity': opacity
        };
        const color_interpolation_for_rgb = [
            'rgb', 
            [ "-", 255, ["*", 21.25, ["-", 42, ['coalesce', ['get', 'Temperatur'], 32.0] ]]],   
            ["*", 255, ['coalesce', ['get', 'VegFrac'], 0.001] ],
            ["*", 25, ['coalesce', ['get', 'cluster17'], 0] ]
        ];

        const paint_definitions_for_rgb = {
            'fill-color': color_interpolation_for_rgb,
            'fill-opacity': 0.6
        };

        let paint_definition = null;
        if (coloring==='vegetation') { 
            paint_definition = paint_definitions_for_vegetation;
        }
        else if (coloring==='temperature') {
            paint_definition = paint_definitions_for_temperature;
        }
        else if (coloring==='cluster') {
            paint_definition = paint_definitions_for_cluster;
        }
        else if (coloring=== 'all') {
            // rgb display that uses 3 values
            paint_definition = paint_definitions_for_rgb;
        }

        return paint_definition;
    }

    calculate_paint_definition_stat_area(coloring: string) {
        const color_step_for_vegetation = [
            'step',
            ['get', 'VegFrac'],
            ['to-color', '#D9D9D9'],
            0.001,
            ['to-color', '#BBDFC3'],
            0.20,
            ['to-color', '#90B192'],
            0.40,
            ['to-color', '#6D8F6E'],
            0.60,
            ['to-color', '#4D734E'],
            0.80,
            ['to-color', '#2B5B34']
        ];

        const color_step_for_temperature = [
            'step',
            ['get', 'median_tem'],
            ['to-color', '#D9D9D9'],
            30,
            ['to-color', '#F7DEDF'],
            33,
            ['to-color', '#EDB1B2'],
            34,
            ['to-color', '#E58586'],
            35,
            ['to-color', '#DE5959'],
            37,
            ['to-color', '#EC1E26']
        ];

        const color_interpolation_for_cluster = [
                    'match', ['coalesce', ['get', 'cluster'], 0],
                    0, ['to-color', '#9BD7F5'],
                    1, ['to-color', '#9BD7F5'],
                    2, ['to-color', '#89C8EE'],
                    3, ['to-color', '#78BBE7'],
                    4, ['to-color', '#66AFE1'],
                    5, ['to-color', '#54A4DB'],
                    6, ['to-color', '#497DB0'],
                    7, ['to-color', '#3C5E91'],
                    8, ['to-color', '#314177'],
                    9, ['to-color', '#272361'],
                    ['to-color', '#1E1E4D'],
                ];

        const paint_definitions_for_temperature = {
            'fill-color': color_step_for_temperature,
            'fill-opacity': 0.6
        };
        const paint_definitions_for_vegetation = {
            'fill-color': color_step_for_vegetation,
            'fill-opacity': 0.6
        };
        const paint_definitions_for_cluster = {
            'fill-color': color_interpolation_for_cluster,
            'fill-opacity': 0.6
        };

        const color_interpolation_for_rgb = [
            'rgb', 
            [ "-", 255, ["*", 21.25, ["-", 42, ['coalesce', ['get', 'median_tem'], 32.0] ]]],   
            ["*", 255, ['coalesce', ['get', 'VegFrac'], 0.001] ],
            ["*", 25, ['coalesce', ['get', 'cluster'], 0] ]
        ];

        const paint_definitions_for_rgb = {
            'fill-color': color_interpolation_for_rgb,
            'fill-opacity': 0.6
        };
        
        let paint_definition = null;
        if (coloring==='vegetation') { 
            paint_definition = paint_definitions_for_vegetation;
        }
        else if (coloring==='temperature') {
            paint_definition = paint_definitions_for_temperature;
        }
        else if (coloring==='cluster') {
            paint_definition = paint_definitions_for_cluster;
        }
        else if (coloring=== 'all') {
            // rgb display that uses 3 values
            paint_definition = paint_definitions_for_rgb;
        }

        return paint_definition;
    }
    
    setLegendOpacity(manual_opacity : number) : number {
        let opacity : number = 0.6;

        // use this to override the default opacity which is given in the constructor of legend
        if (this.legend) {
            // this.legend.opacity = 0.9;
            // console.log('setting legend.opacity to ' + this.legend.opacity);

            opacity = this.legend.opacity;
            console.log('this.legend.opacity=' + opacity);
            }
        
        if (manual_opacity !== -1) {
            console.log('overriding opacity with ', manual_opacity);
            opacity = manual_opacity;
        }
        
        return opacity;
    }
}

export class OdotState extends State {
    constructor(filters: any) {
        super('odot', undefined, filters);
    }
}
