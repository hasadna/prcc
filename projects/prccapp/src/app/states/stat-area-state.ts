import { State, LayerConfig } from "./base-state";
import { QP_REGION_COLORING, QP_REGION_COLORING_CAR, QP_REGION_COLORING_CPC, REGION_COLORING_INTERPOLATE, REGION_COLORING_LEGEND, STAT_AREA_FILTER_ITEMS } from "./consts-regions";

export class StatAreaState extends State {
    constructor(id: string, filters: any) {
        super('stat-area', id, filters);
        console.log('StatAreaState constructor STARTED');
        this.sql = [
            `SELECT * FROM stat_areas WHERE code = '${this.id}'`,
            `SELECT "meta-source" as name, count(1) as count FROM trees_processed WHERE "stat_area_code" = '${this.id}' GROUP BY 1 order by 2 desc`,
            `SELECT count(1) as total_count FROM trees_compact WHERE "stat_area_code" = '${this.id}'`,
        ];
        for (const id of ['stat-areas-label', 'stat-areas-border', 'stat-areas-fill']) {
            this.layerConfig[id] = new LayerConfig([
                '==', ['get', 'code'], ['literal', this.id]
            ], null, null);
        }
        let coloring = this.filters[QP_REGION_COLORING] || QP_REGION_COLORING_CAR;
        if (coloring === QP_REGION_COLORING_CPC) {
            coloring = QP_REGION_COLORING_CAR;
        }
        this.legend = REGION_COLORING_LEGEND[coloring];
        this.layerConfig['stat-areas-fill'].paint = {
            'fill-color': REGION_COLORING_INTERPOLATE[coloring],
            'fill-opacity': 0.8
        };
        this.layerConfig['stat-areas-border'].paint = {
            'line-color': '#ff871f',
            'line-opacity': 0.4
        };
        this.filterItems = STAT_AREA_FILTER_ITEMS;

        //const paint_definition = this.calculate_paint_definition(coloring, this.setLegendOpacity(this.manual_opacity)); // <== this defines the colors of the polygons according to the display selected in the drop-down
        const paint_definition = this.calculate_paint_definition_stat_area(coloring);
        const statarea_filter_def = this.calc_filter(); // <== this filter causes map to display only the polygon of the stat-area (whose id is in the URL)
        this.layerConfig['prcc-statistical-areas'] = new LayerConfig(statarea_filter_def, paint_definition, null);

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
        // this causes the layers in array 'background_layers' to be available/visible in stat-area view:
        for (const layerId of background_layers) {
            this.layerConfig[layerId] = new LayerConfig(null, null, null);
            if (layerId === 'trees') {
                // The filter part causes only trees in the SELECTED stat-area to be displayed
                // Note that in some areas the trees disappear when area is selected!
                // (probably because their "stat_area" property has an incorrect value)
                // commenting the following line will cause trees of all areas to be displayed
                this.layerConfig['trees'].filter = ['==', ['get', 'stat_area'], ['literal', this.id] ];

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
            if ((layerId === 'parcels') || (layerId === 'parcels-labels') || (layerId === 'canopies')) {
                this.layerConfig[layerId].layout = {'visibility': 'visible'};
            }
        }
    }

    calc_filter() {
        const filter = [
            '==', ['get', 'semel_new'], Number(this.id)
        ];
        // semel_new or YISHUV_STA ?
        return filter;
    }



    override handleData(data: any[][]) {
        console.log("STAT AREA DATA", this.sql, data)
        if (data[0].length && data[0][0]) {
            this.geo = {
                zoom: 14,
                center: data[0][0]['center']
            };    
        }
    }

}
