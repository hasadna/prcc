import * as Plot from '@observablehq/plot';

import { State, LayerConfig, Chart } from "./base-state";
import { MUNIS_FILTER_ITEMS, QP_MUNI_FILTER_PD, QP_MUNI_FILTER_PD_HIGH, QP_MUNI_FILTER_PD_LOW, QP_MUNI_FILTER_PD_MID, QP_MUNI_FILTER_SEI, QP_MUNI_FILTER_SEI_HIGH, QP_MUNI_FILTER_SEI_LOW, QP_MUNI_FILTER_SEI_MID, QP_REGION_COLORING, QP_REGION_COLORING_CAR, REGION_COLORING_INTERPOLATE, REGION_COLORING_LEGEND } from './consts-regions';

export class MunisState extends State {
    constructor(filters: any) {
        console.log('MunisState constructor, filters=', filters);
        // following if statement is a hack to make sure the view filter is "by temperature" unless selected otherwise!
        if (!filters["rc"]) {
            filters["rc"] = 'temperature';
        }
        // hack: if you manually add "opacity=0.6" or any other value to URL, we use that value for opacity
        let manual_opacity = -1;
        if (filters["opacity"]) {
            manual_opacity = Number(filters["opacity"]);
            if (!(manual_opacity > 0 && manual_opacity <= 1)) {
                manual_opacity = -1;
            }
        }


        // the filters arg contains the URL part that represents the drop-down selection!
        super('munis', undefined, filters);


        let layerFilters: any[][] = [];

        let seiCondition = 'TRUE';
        if (this.filters[QP_MUNI_FILTER_SEI] === QP_MUNI_FILTER_SEI_HIGH) {
            seiCondition = '(socioeconomic_index >= 8 and socioeconomic_index <= 10)';
            layerFilters.push(['>=', ['get', 'socioeconomic_index'], 8]);
        } else if (this.filters[QP_MUNI_FILTER_SEI] === QP_MUNI_FILTER_SEI_MID) {
            seiCondition = '(socioeconomic_index >= 4 and socioeconomic_index <= 7)';
            layerFilters.push(['all', ['>=', ['get', 'socioeconomic_index'], 4], ['<=', ['get', 'socioeconomic_index'], 7]]);
        } else if (this.filters[QP_MUNI_FILTER_SEI] === QP_MUNI_FILTER_SEI_LOW) {
            seiCondition = '(socioeconomic_index >= 1 and socioeconomic_index <= 3)';
            layerFilters.push(['<=', ['get', 'socioeconomic_index'], 3]);
        }

        let pdCondition = 'TRUE';
        if (this.filters[QP_MUNI_FILTER_PD] === QP_MUNI_FILTER_PD_HIGH) {
            pdCondition = '(population_density >= 5000)';
            layerFilters.push(['>=', ['get', 'population_density'], 5000]);
        } else if (this.filters[QP_MUNI_FILTER_PD] === QP_MUNI_FILTER_PD_MID) {
            pdCondition = '(population_density >= 1000 and population_density < 5000)';
            layerFilters.push(['all', ['>=', ['get', 'population_density'], 1000], ['<', ['get', 'socioeconomic_index'], 5000]]);
        } else if (this.filters[QP_MUNI_FILTER_PD] === QP_MUNI_FILTER_PD_LOW) {
            pdCondition = '(population_density < 1000)';
            layerFilters.push(['<', ['get', 'population_density'], 1000]);
        }

        this.sql = [
            `SELECT muni_name, canopy_area_ratio*100 as ratio, canopy_per_capita::numeric as cpc FROM munis WHERE ${seiCondition} AND ${pdCondition} ORDER BY canopy_area_ratio DESC nulls last`,
        ];
        for (const id of ['munis-label', 'munis-border', 'munis-fill']) {
            this.layerConfig[id] = new LayerConfig([
                'all',
                ['>', ['get', 'canopy_area_ratio'], 0],
                ...layerFilters
            ], null, null);
        }
        const coloring = this.filters[QP_REGION_COLORING] || QP_REGION_COLORING_CAR;
        this.legend = REGION_COLORING_LEGEND[coloring];
        this.layerConfig['munis-fill'].paint = {
            'fill-color': REGION_COLORING_INTERPOLATE[coloring],
            'fill-opacity': 0.8
        };
        this.layerConfig['munis-border'].paint = {
            'line-color': '#155b2e',
            'line-opacity': 0.4
        };

        this.filterItems = MUNIS_FILTER_ITEMS;  // populate filterItems, which in FilterComponent is used to specify the drop-downs controls in the fiters area in the header of page

        this.popupLayers = {
            'munis-fill': [
                {label: 'שם הרשות', content: (p: any) => p.muni_name},
                {label: 'אוכלוסיה', content: (p: any) => p.population.toLocaleString()},
                {label: 'כיסוי צומח לנפש', content: (p: any) => p.canopy_per_capita.toFixed(1) + ' מ"ר'},
            ]//stat-areas-fill
        }

        // use this to override the default opacity which is given in the constructor of legend
        if (this.legend) {
            this.legend.opacity = 0.9;
            console.log('setting legend.opacity to ' + this.legend.opacity);
        }
        
        let opacity = this.legend.opacity;
        console.log('this.legend.opacity=' + opacity);
        if (manual_opacity !== -1) {
            console.log('overriding opacity with ', manual_opacity);
            opacity = manual_opacity;
        }

        const paint_definition = this.calculate_paint_definition(coloring, opacity);
        /**
         * This is the layer of the Settlements Data
         * Its paint_definition defines the colors of the different polygons based on the
         * value of a property from the json data. The property names in the json are:
         * "Temperatur", "VegFrac", "cluster17"
         * for each of them we created a suitable formula/expression: 
         * paint_definitions_for_temperature, paint_definitions_for_vegetation, etc
         */
        this.layerConfig['prcc-settlements-data'] = new LayerConfig(null, paint_definition, null);
        // this causes the layer of raster lst-30 to be visible in munis view:
        //this.layerConfig['evyatark-lst-image-30'] = new LayerConfig(null, null, null);

        this.layerConfig['prcc-settlements-data-borders'] = new LayerConfig(null, null, null);
        this.layerConfig['prcc-settlements-data-borders'].paint = {
            //'line-color': '#155b2e',
            'line-width': ["step",["zoom"],0,10,1],    // <== this causes area borders to be revealed only in zoom level 10
            'line-opacity': 1
        };

        this.handle_background_layers('bglayers');

    }

    handle_background_layers(layer_query_param_name : string) {
        const background_layers = [];
        // this takes from the URL ("http://localhost:4200/munis?bglayers=gush;yaad") the part "gush;yaad"
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
            if ((id === 'parcels') || (id === 'parcels-labels')) {
                this.layerConfig[id].layout = {'visibility': 'visible'};
            }
            if (id === 'canopies') {
                this.layerConfig[id].layout = {'visibility': 'visible'};
            }
        }
    }

    calculate_paint_definition(coloring: string, opacity : number) {
        const color_interpolation_for_vegetation = [
            'interpolate', ['exponential', 0.01], ['get', 'VegFrac'],
            0, ['to-color', '#ccc'],
            0.5, ['to-color', '#acecc2'],
            0.6, ['to-color', '#155b2e'],
        ];

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

        
        // value for Red should be 0-255. temperature is about 30 - 42, (Eilat: 41.03) 
        // so I take (42-temperature)
        // and multiply by 255/(42-30). But I want hotter to be redder, so: 255 - (21.25*(42-temperature))
        // so:             [ "-", 255, ["*", 21.25, ["-", 42, ['get', 'Temperatur']]]]
        //
        // Value for Green: VegFrac is 0.001 - 0.95. so 255 * VegFrac : ["*", 255, ['get', 'VegFrac']]
        //
        // Value for Blue: cluster is 1-10 (or 0-10?), so 25*cluster
        //
        // coalesce means: if value of ['get', 'cluster17'] does not exist, use the supplied default instead.
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
        this.charts = [];
        if (data[0].length) {
            console.log("MUNI DATA", data[0])
            this.charts.push(new Chart(
                'הרשויות עם כיסוי חופות העצים הגבוה ביותר:',
                Plot.plot({
                    height: 250,
                    width: 340,
                    y: {
                        axis: null,
                    },
                    x: {
                        grid: true,
                        tickFormat: d => d + '%',
                        label: 'אחוז כיסוי חופות העצים',
                        labelAnchor: 'center',
                    },
                    marks: [
                        Plot.barX(data[0].slice(0,10), {
                            y: 'muni_name',
                            x: 'ratio',
                            fill: '#204E37',
                            sort: {y: '-x'}
                        }),
                        Plot.text(data[0].slice(0,10), {
                            x: 'ratio',
                            y: 'muni_name',
                            text: 'muni_name',
                            textAnchor: 'start',
                            dx: -3,
                            fill: '#fff',
                        }),
                        Plot.ruleX([0]),
                    ]
                })
            ));
            this.charts.push(new Chart(
                'התפלגות כיסוי חופות העצים בין הרשויות:',
                Plot.plot({
                    height: 250,
                    width: 340,
                    marginLeft: 30,
                    y: {
                        grid: true,
                        label: 'מספר רשויות',
                        tickPadding: 15,
                        labelAnchor: 'center',
                        labelOffset: 30,
                    },
                    x: {
                        label: 'אחוז כיסוי חופות העצים',
                        tickFormat: d => d + '%',
                        labelAnchor: 'center',
                    },
                    marks: [
                        Plot.rectY(data[0], {
                            ...Plot.binX({y: 'count'}, {x: 'ratio', interval: 2.5}),
                            fill: '#204E37',
                        }),
                        Plot.ruleY([0]),
                    ]
                })
            ));
            const topCpc = data[0].filter(d => d.cpc > 0).sort((a,b) => b.cpc - a.cpc).slice(0,10);
            this.charts.push(new Chart(
                'הרשויות עם שטח חופות העצים לנפש הגבוה ביותר:',
                Plot.plot({
                    height: 250,
                    width: 340,
                    y: {
                        axis: null,
                    },
                    x: {
                        grid: true,
                        label: 'שטח חופות העצים לנפש במ״ר',
                        labelAnchor: 'center',
                    },
                    marks: [
                        Plot.barX(topCpc, {
                            y: 'muni_name',
                            x: 'cpc',
                            fill: '#204E37',
                            sort: {y: '-x'}
                        }),
                        Plot.text(topCpc, {
                            x: 'cpc',
                            y: 'muni_name',
                            text: 'muni_name',
                            textAnchor: 'start',
                            dx: -3,
                            fill: '#fff',
                        }),
                        Plot.ruleX([0]),
                    ]
                })
            ));
        }
    }

}
