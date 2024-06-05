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
        // // hack: if you manually add "opacity=0.6" or any other value to URL, we use that value for opacity
        // let manual_opacity = -1;
        // if (filters["opacity"]) {
        //     manual_opacity = Number(filters["opacity"]);
        //     if (!(manual_opacity > 0 && manual_opacity <= 1)) {
        //         manual_opacity = -1;
        //     }
        // }


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

        const opacity = this.setLegendOpacity(this.manual_opacity);
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
