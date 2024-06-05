import * as Plot from '@observablehq/plot';
import { State, LayerConfig, Chart } from './base-state';
import { QP_REGION_COLORING, QP_REGION_COLORING_CAR, REGION_COLORING_LEGEND, REGION_COLORING_INTERPOLATE, STAT_AREA_FILTER_ITEMS, QP_REGION_COLORING_CPC } from './consts-regions';


export class StatAreasState extends State {
    constructor(filters: any) {
        //console.log('StatAreasState constructor, filters=', filters);

        // following if statement is a hack to make sure the view filter is "by temperature" unless selected otherwise!
        if (!filters["rc"]) {
            filters["rc"] = 'temperature';
        }
        // the filters arg contains the URL part that represents the drop-down selection!
        super('stat-areas', undefined, filters);
        this.sql = [
            `SELECT round(canopy_area_ratio*20) * 5 as ratio, count(1) as count FROM stat_areas WHERE canopy_area_ratio > 0 GROUP BY 1 ORDER BY 1 `,
        ];
        for (const id of ['stat-areas-label', 'stat-areas-border', 'stat-areas-fill']) {
            this.layerConfig[id] = new LayerConfig([
                '>', ['get', 'canopy_area_ratio'], 0
            ], null, null);
        }
        this.layerConfig['munis-label'] = new LayerConfig(null, null, null);
        let coloring = this.filters[QP_REGION_COLORING] || QP_REGION_COLORING_CAR;
        this.legend = REGION_COLORING_LEGEND[coloring];
        this.layerConfig['stat-areas-fill'].paint = {
            'fill-color': REGION_COLORING_INTERPOLATE[coloring],
            'fill-opacity': 0.8
        };
        //this.layerConfig['stat-areas-border'].paint = {
        //this.layerConfig['trees'] = new LayerConfig(null, null, null);
        this.filterItems = STAT_AREA_FILTER_ITEMS;

        this.popupLayers = {
            'stat-areas-fill': [
                {label: 'מזהה האזור', content: (p: any) => p.code},
                {label: 'יישוב', content: (p: any) => p.city_name || 'לא ידוע'},
                {label: 'אחוז כיסוי צומח', content: (p: any) => (100 * p.canopy_area_ratio).toFixed(1) + '%'},
            ]
        }

        const paint_definition = this.calculate_paint_definition_stat_area(coloring);
        /**
         * This is the layer of the Settlements Data
         * Its paint_definition defines the colors of the different polygons based on the
         * value of a property from the json data. The property names in the json are:
         * "Temperatur", "VegFrac", "cluster17"
         * for each of them we created a suitable formula/expression: 
         * paint_definitions_for_temperature, paint_definitions_for_vegetation, etc
         */
        // adding a LayerConfig to the layerConfig[] array, with key 'prcc-statistical-areas',
        // assumes there is a layer with that exact name in the map, and will cause that layer
        // to become visible when the current state (stat-areas-state) is initilized - which is
        // when the display to which it is attached is selected in UI.
        // current state object is created in StateService.initFromUrl(), which is called from the
        // event handler of any router event (this is defined in AppComponent)
        this.layerConfig['prcc-statistical-areas'] = new LayerConfig(null, paint_definition, null);
        this.layerConfig['prcc-statistical-areas-borders'] = new LayerConfig(null, null, null);
        this.layerConfig['prcc-statistical-areas-borders'].paint = {
            //'line-color': '#155b2e',
            'line-width': ["step",["zoom"],0,11,1,14,2],    // <== this causes area borders to be revealed only in zoom level 11, and become double width only at zoom 14
            'line-opacity': 1
        };

        this.handle_background_layers('sbglayers');

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
        // this causes the layers in array 'layers' to be available/visible in trees view:
        for (const id of background_layers) {
            this.layerConfig[id] = new LayerConfig(null, null, null);
            if (id === 'trees') {
                const TREE_COLOR_INTERPOLATE = [
                    'case', ['get', 'certainty'],
                    ['to-color', '#204E37'],
                    ['to-color', '#64B883'],
                ];
                this.layerConfig['trees'].paint = {
                    'circle-color': TREE_COLOR_INTERPOLATE,
                    'circle-radius': [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        15, 2,  // zoom is 15 (or less) -> circle radius will be 2px
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
            if ((id === 'parcels') || (id === 'parcels-labels') || (id === 'canopies')) {
                this.layerConfig[id].layout = {'visibility': 'visible'};
            }
        }
    }

    // calculate_paint_definition_stat_area(coloring: string) {
    //     const color_step_for_vegetation = [
    //         'step',
    //         ['get', 'VegFrac'],
    //         ['to-color', '#D9D9D9'],
    //         0.001,
    //         ['to-color', '#BBDFC3'],
    //         0.20,
    //         ['to-color', '#90B192'],
    //         0.40,
    //         ['to-color', '#6D8F6E'],
    //         0.60,
    //         ['to-color', '#4D734E'],
    //         0.80,
    //         ['to-color', '#2B5B34']
    //     ];

    //     const color_step_for_temperature = [
    //         'step',
    //         ['get', 'median_tem'],
    //         ['to-color', '#D9D9D9'],
    //         30,
    //         ['to-color', '#F7DEDF'],
    //         33,
    //         ['to-color', '#EDB1B2'],
    //         34,
    //         ['to-color', '#E58586'],
    //         35,
    //         ['to-color', '#DE5959'],
    //         37,
    //         ['to-color', '#EC1E26']
    //     ];

    //     const color_interpolation_for_cluster = [
    //                 'match', ['coalesce', ['get', 'cluster'], 0],
    //                 0, ['to-color', '#9BD7F5'],
    //                 1, ['to-color', '#9BD7F5'],
    //                 2, ['to-color', '#89C8EE'],
    //                 3, ['to-color', '#78BBE7'],
    //                 4, ['to-color', '#66AFE1'],
    //                 5, ['to-color', '#54A4DB'],
    //                 6, ['to-color', '#497DB0'],
    //                 7, ['to-color', '#3C5E91'],
    //                 8, ['to-color', '#314177'],
    //                 9, ['to-color', '#272361'],
    //                 ['to-color', '#1E1E4D'],
    //             ];

    //     const paint_definitions_for_temperature = {
    //         'fill-color': color_step_for_temperature,
    //         'fill-opacity': 0.6
    //     };
    //     const paint_definitions_for_vegetation = {
    //         'fill-color': color_step_for_vegetation,
    //         'fill-opacity': 0.6
    //     };
    //     const paint_definitions_for_cluster = {
    //         'fill-color': color_interpolation_for_cluster,
    //         'fill-opacity': 0.6
    //     };

    //     const color_interpolation_for_rgb = [
    //         'rgb', 
    //         [ "-", 255, ["*", 21.25, ["-", 42, ['coalesce', ['get', 'median_tem'], 32.0] ]]],   
    //         ["*", 255, ['coalesce', ['get', 'VegFrac'], 0.001] ],
    //         ["*", 25, ['coalesce', ['get', 'cluster'], 0] ]
    //     ];

    //     const paint_definitions_for_rgb = {
    //         'fill-color': color_interpolation_for_rgb,
    //         'fill-opacity': 0.6
    //     };
        
    //     let paint_definition = null;
    //     if (coloring==='vegetation') { 
    //         paint_definition = paint_definitions_for_vegetation;
    //     }
    //     else if (coloring==='temperature') {
    //         paint_definition = paint_definitions_for_temperature;
    //     }
    //     else if (coloring==='cluster') {
    //         paint_definition = paint_definitions_for_cluster;
    //     }
    //     else if (coloring=== 'all') {
    //         // rgb display that uses 3 values
    //         paint_definition = paint_definitions_for_rgb;
    //     }

    //     return paint_definition;
    // }

    override handleData(data: any[][]) {
        this.charts = [];
        if (data[0].length) {
            console.log("STAT-AREA DATA", data[0])
            this.charts.push(new Chart(
                'התפלגות כיסוי חופות העצים בין האזורים הסטטיסטיים:',
                Plot.plot({
                    height: 250,
                    width: 340,
                    marginLeft: 50,
                    y: {
                        grid: true,
                        label: 'מספר האזורים',
                        tickPadding: 20,
                        labelAnchor: 'center',
                        labelOffset: 40,
                    },
                    x: {
                        label: 'אחוז כיסוי חופות העצים',
                        tickFormat: d => d + '%',
                        labelAnchor: 'center',
                    },
                    marks: [
                        Plot.barY(data[0], {y: 'count', x: 'ratio', fill: '#204E37'}),
                        Plot.ruleY([0]),
                    ]
                })
            ));
        }
    }
}