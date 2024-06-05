import { State, LayerConfig} from "./base-state";
import { MUNI_FILTER_ITEMS, QP_REGION_COLORING, QP_REGION_COLORING_CAR, REGION_COLORING_INTERPOLATE, REGION_COLORING_LEGEND } from "./consts-regions";

export class MuniState extends State {
    constructor(id: string, filters: any) {
        // hack: if you manually add "opacity=0.6" or any other value to URL, we use that value for opacity
        let manual_opacity = -1;
        if (filters["opacity"]) {
            manual_opacity = Number(filters["opacity"]);
            if (!(manual_opacity > 0 && manual_opacity <= 1)) {
                manual_opacity = -1;
            }
        }
        
        super('muni', id, filters);
        console.log('MuniState constructor STARTED');
        this.sql = [
            `SELECT * FROM munis WHERE "muni_code" = '${this.id}'`,
            `SELECT "meta-source" as name, count(1) as count FROM trees_processed WHERE "muni_code" = '${this.id}' GROUP BY 1 order by 2 desc`,
            `SELECT count(1) as total_count FROM trees_compact WHERE "muni_code" = '${this.id}'`,
        ];
        for (const id of ['munis-label', 'munis-border', 'munis-fill']) {
            this.layerConfig[id] = new LayerConfig([
                '==', ['get', 'muni_code'], ['literal', this.id]
            ], null, null);
        }
        const coloring = this.filters[QP_REGION_COLORING] || QP_REGION_COLORING_CAR;
        this.legend = REGION_COLORING_LEGEND[coloring];
        this.layerConfig['munis-fill'].paint = {
            'fill-color': REGION_COLORING_INTERPOLATE[coloring],
            'fill-opacity': 0.8
        };
        this.layerConfig['munis-border'].paint = {
            'line-color': '#ff871f',
            'line-opacity': 0.4
        };
        this.legend = REGION_COLORING_LEGEND[coloring];
        this.filterItems = MUNI_FILTER_ITEMS;

        const paint_definition = this.calculate_paint_definition(coloring, manual_opacity); // <== this defines the colors of the polygons according to the display selected in the drop-down
        const muni_filter_def = this.calc_filter(); // <== this filter causes map to display only the polygon of the city (whose id is in the URL)
        this.layerConfig['prcc-settlements-data'] = new LayerConfig(muni_filter_def, paint_definition, null);

        this.handle_background_layers('bglayers');
    }
    
    handle_background_layers(layer_query_param_name : string) {
        const background_layers = [];
        // this takes from the URL ("http://localhost:4200/munis?bglayers=gush;yaad") the part "all;low"
        // and splits it to a list of [all, low] so that it can be processed
        this.filters[layer_query_param_name] = (this.filters[layer_query_param_name] || '').split(';').filter((s: string) => s.length > 0)
        console.log('list of layers in multi select:', this.filters[layer_query_param_name]);
        if (this.filters[layer_query_param_name].length > 0) {
            // here use the list of layers to change visibility of selected layers etc
            const selectedLayers = this.filters[layer_query_param_name];
            console.log('selected layers:', selectedLayers);    // kll, gush, pst, yaad, bus
            if (selectedLayers.includes('gush')) {
                console.log('displaying Gush-Chelka layer');
                background_layers.push('parcels');            
                background_layers.push('parcels-labels');            
                //background_layers.push('sub-gush-all');            
            }
            if (selectedLayers.includes('yaad')) {
                console.log('displaying Yaad Trees layer');
                background_layers.push('trees');            
            }
            if (selectedLayers.includes('hupot')) {
                console.log('displaying Yaad Canopies layer');
                background_layers.push('canopies');            
            }
        }
        console.log('bg layers:', background_layers);
        // this causes the layers in array 'layers' to be available/visible in trees view:
        for (const layerId of background_layers) {
            this.layerConfig[layerId] = new LayerConfig(null, null, null);
            if (layerId === 'trees') {
                this.layerConfig['trees'].filter = [
                    '==', ['get', 'muni'], ['literal', this.id]
                    ];
                const TREE_COLOR_INTERPOLATE = [
                    'case', ['get', 'certainty'],
                    ['to-color', '#204E37'],
                    ['to-color', '#64B883'],
                ];
                this.layerConfig['trees'].paint = {
                    'circle-color': TREE_COLOR_INTERPOLATE,
                    // note that circle-radius expression here is a bit different from munis, stat-areas, stat-area view
                    // (this displays a bit larger circles in zoom 10-15)
                    'circle-radius': [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        10, 2,  // zoom is 10 (or less) -> circle radius will be 2px
                        15, 3,  // zoom is 15           -> circle radius will be 3px
                        18, 5   // zoom is 18 (or greater) -> circle radius will be 5px
                    ],
                    'circle-stroke-width': [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        15, 0,
                        18, 3
                    ],
                    'circle-stroke-color': '#ffffff',
                };
            }
            if ((layerId === 'parcels') || (layerId === 'parcels-labels') || (layerId === 'canopies')) {
                this.layerConfig[layerId].layout = {'visibility': 'visible'};
            }
        }
    }

    calc_filter() {
        const filter = [
            '==', ['get', 'CODE'], Number(this.id)
        ];
        return filter;
    }

    calculate_paint_definition(coloring: string, manual_opacity : number) {
        const color_interpolation_for_vegetation = [
            'interpolate', ['exponential', 0.01], ['get', 'VegFrac'],
            0, ['to-color', '#ccc'],
            0.5, ['to-color', '#acecc2'],
            0.6, ['to-color', '#155b2e'],
        ];

        const color_interpolation_for_temperature = [
            'interpolate', ['exponential', 0.01], ['get', 'Temperatur'],
            //'interpolate', ['exponential', 0.99], ['get', 'Temperatur'],
            30, ['to-color', '#FFFF00'],
            35, ['to-color', '#FFA500'],
            40, ['to-color', '#FF0000'],
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

        let opacity = 0.6;
        if (manual_opacity !== -1) {
            console.log('overriding opacity with', manual_opacity);
            opacity = manual_opacity;
        }
        console.log('using opacity ', opacity);
        const paint_definitions_for_temperature = {
            'fill-color': color_step_for_temperature,
            //'fill-color': color_interpolation_for_temperature,
            'fill-opacity': opacity
        };
        const paint_definitions_for_vegetation = {
            'fill-color': color_interpolation_for_vegetation,   // ToDo change to step
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

    override handleData(data: any[][]) {
        if (data[0].length && data[0][0]) {
            this.geo = {
                zoom: 13,
                center: data[0][0]['center']
            };    
        }
    }

}

