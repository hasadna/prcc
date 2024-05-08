import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { MapboxService } from '../mapbox.service';
import * as mapboxgl from 'mapbox-gl';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { StateService } from '../state.service';
import { Router } from '@angular/router';
import { ApiService } from '../api.service';

@UntilDestroy()
@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.less']
})
export class MapComponent implements AfterViewInit{

  // if changing to a different account you need to change also the ACCESS TOKEN in MapboxService!!
  STYLE = 'mapbox://styles/evyatark3108/clnljjtd7003i01plcccdek9h/draft'; // evyatark3108 prcc01

  OWN_LAYERS = [
    'prcc-settlements-data',
    'prcc-statistical-areas',
    'prcc-settlements-data-borders',
    'prcc-statistical-areas-borders',
    'parcels', // gush chelka
    'parcels-labels', // gush chelka
    'trees', // yaad trees
    'canopies', // yaad chupot
    'lst-tiles-8-11',
    'evyatark-lst-tiles-8-16',
    'evyatark-ndvi-tiles-8-16',
    'satellite'
  ];
  CLICKS = [
    ['prcc-statistical-areas', 'stat-areas', 'semel_new'],
    // ['trees', 'trees', 'tree-id'],
    ['prcc-settlements-data', 'munis', 'CODE'],
  ];
  
  @ViewChild('map') mapEl: ElementRef;    // <== access the HTML element containing the attribute "#map"

  map: mapboxgl.Map;

  focus_: string|null = null;

  popup: mapboxgl.Popup | null = null;

  constructor(private mapboxService: MapboxService, 
              private state: StateService,
              private router: Router, 
              private api: ApiService) {
  }

  ngAfterViewInit() {
    this.mapboxService.init.subscribe(() => {
      this.initialize();
    });
  }

  click_on_map(e: any, base: string, prop: string) {
    const features = e.features;
    if (features && features.length > 0) {
      const feature: any = features[0];
      if (feature.properties?.[prop]) {
        this.router.navigate([base, feature.properties[prop]], {queryParamsHandling: 'merge'});
      }
    }
  }

  initialize() {
    const mapParams: mapboxgl.MapboxOptions = {
      container: this.mapEl.nativeElement,
      style: this.STYLE,
      minZoom: 6.4,
      //zoom: 7,
      attributionControl: false,
      bounds: [[34.578046, 33.2], [35.356111, 30.8]],
      maxBounds: [[30, 27], [40, 38]],
      preserveDrawingBuffer: true,
    };
    this.map = new mapboxgl.Map(mapParams);
    this.map.addControl(new mapboxgl.AttributionControl(), 'top-right');
    this.map.addControl(new mapboxgl.NavigationControl({showCompass: false}), 'top-left');
    
    this.map.dragRotate.disable();
    this.map.touchZoomRotate.disableRotation();
    this.map.touchPitch.disable();

    this.map.on('load', () => {
      console.log('on load STARTED');
      this.CLICKS.forEach(([layer, base, prop]) => {
        this.map.on('click', layer, (e) => {
          this.click_on_map(e, base, prop);
          // const features = e.features;
          // if (features && features.length > 0) {
          //   const feature: any = features[0];
          //   if (feature.properties?.[prop]) {
          //     this.router.navigate([base, feature.properties[prop]], {queryParamsHandling: 'merge'});
          //   }
          // }
        });
      });
      console.log('LAYERS:');
      //console.log(this.map.getStyle().layers);
      this.OWN_LAYERS.forEach((layer) => {
        console.log(layer);
        // This adds a Hover tooltip for each layer! for ALL layers in OWN_LAYERS!!
        // the mechanism based on *state classes does this in a more general way!!
        this.map.on('mousemove', layer, (e: mapboxgl.MapLayerMouseEvent) => {
          if (e.defaultPrevented) {
            return;
          }
          e.preventDefault();
          if (e.features && e.features.length > 0) {
            this.map.getCanvas().style.cursor = 'pointer';
            this.addPopup(e.features[0], e.lngLat, layer)
            this.saveLastFeature(e.features[0]);
          }
        });
      });
      this.map.on('mousemove', (e: mapboxgl.MapLayerMouseEvent) => {
        if (e.defaultPrevented) {
          return;
        }
        e.preventDefault();
        this.map.getCanvas().style.cursor = '';
        this.removePreviousPopup();
      });
      this.state.state.pipe(
        untilDestroyed(this),
      ).subscribe((state) => {
        if (state.geo) {
          this.map.flyTo({
            center: state.geo.center,
            zoom: state.geo.zoom,
            // padding: {top:0, bottom:0, left:0, right: 400}
          });
        }
        console.log('STATE', state, this.map.getStyle().layers);
        if (state.filters?.focus !== this.focus_) {
          this.focus_ = state.filters?.focus;
          if (state.focus) {
            const QUERY = state.focus.boundsQuery();
            if (QUERY) {
              this.api.query(QUERY).subscribe((res) => {
                this.map.fitBounds(
                  res[0].bounds,
                  // {padding: {top:0, bottom:0, left:0, right: 400}}
                );
              });
            }
          }
        }
        const extraFilters = state.focus?.mapFilters() || {};
        
        this.map.getStyle().layers.forEach((layer) => {
          if (layer.id.startsWith("prcc") || layer.id.startsWith("evyatark")) {
            console.log(layer);
          }
          // if (layer.id === 'sub-gush-all') {  //(layer.id === 'parcels') {
          //   console.log("parcels layer");
          // }
          if (this.ownLayer(layer)) {
            // tell the map to show or hide this layer
            if (state.isLayerVisible(layer.id)) {
              console.log('set visibility of layer', layer.id, 'to visible');
              this.map.setLayoutProperty(layer.id, 'visibility', 'visible');
            } else {
              console.log('set visibility of layer', layer.id, 'to none');
              this.map.setLayoutProperty(layer.id, 'visibility', 'none');
              return;
            }
            const lc = state.getLayerConfig(layer.id);
            console.log('OWN LAYER', layer.id, lc);
            const filters: any[][] = [];
            if (lc?.filter) {
              filters.push(lc.filter);
            } 
            if (extraFilters[layer.id]) {
              filters.push(extraFilters[layer.id]);
            }
            console.log('FILTERS', extraFilters, lc.filter, filters.length, ['all', ...filters]);
            if (filters.length > 1) {
              this.map.setFilter(layer.id, ['all', ...filters]);
            } else if (filters.length === 1) {
              this.map.setFilter(layer.id, filters[0]);
            } else {
              this.map.setFilter(layer.id, null);
            }
            if (lc?.paint) {
              Object.keys(lc.paint).forEach((key) => {
                // layerConfig.paint property has a value '' - acording to this value we decide which property defines the colors of the polygons
                this.map.setPaintProperty(layer.id, key, lc.paint[key]);
              });
            }
            if (lc?.layout) {
              Object.keys(lc.layout).forEach((key) => {
                this.map.setLayoutProperty(layer.id, key, lc.layout[key]);
              });
            }
          }
        });
      });
      this.mapboxService.map = this.map;
      console.log('on load FINISHED');
    });
  }

  ownLayer(layer: mapboxgl.AnyLayer) {
    return this.OWN_LAYERS.includes(layer.id);
  }

  addPopup(feature: any, lngLat: mapboxgl.LngLatLike, layer: string) {
    this.removePreviousPopup()
    let htmlContent = '';
    if (layer === 'prcc-settlements-data') {
      htmlContent = this.createPopupHtmlContentSettlements(feature);
    }
    else if (layer === 'prcc-statistical-areas') {
      htmlContent = this.createPopupHtmlContentStatistical(feature); 
    }
    this.popup = new mapboxgl.Popup({ closeButton: false })
              .setLngLat(lngLat)
              .setHTML(htmlContent)
              .addTo(this.map);
  }
  removePreviousPopup() {
    if (this.popup !== null) {
      this.popup.remove();
      this.popup = null;
    }
  }

  createPopupHtmlContentStatistical(feature: any) {
    const content = '<div dir="rtl">' + '<strong>' + feature.properties['SHEM_YISHU'] + 
    //' ' + 'איזור' + ' ' + feature.properties['STAT11'] + 
    '</strong><br/>' +
    //'<strong>muni: </strong>' + feature.properties['SHEM_YIS_1'] + '<br/>' +
    // '<strong>population: </strong>' + feature.properties['Pop_Total'] + '<br/>' +
    // '<strong>city code: </strong>' + feature.properties['semel_yesu'] + '<br/>' +
    // '<strong>area code: </strong>' + feature.properties['STAT11'] + '<br/>' +
    // '<strong>temperature: </strong>' + this.round(feature.properties['median_tem']) + '<br/>' +
    // '<strong>VegFrac: </strong>' + this.round(feature.properties['VegFrac'], 4) + '<br/>' +
    // '<strong>cluster: </strong>' + feature.properties['cluster'] + 
    // '<br>'+
    '<strong>איזור סטטיסטי: </strong>' + feature.properties['STAT11'] + '<br/>' +
    '<strong>אוכלוסיה: </strong>' + feature.properties['Pop_Total'] + '<br/>' +
    // '<strong>city code: </strong>' + feature.properties['semel_yesu'] + '<br/>' +
    '<strong>דירוג כלכלי חברתי: </strong>' + feature.properties['cluster'] + '<br/>' +
    '<strong>טמפרטורה: </strong>' + this.round(feature.properties['median_tem']) + '<br/>' +
    '<strong>כיסוי צומח: </strong>' + this.round(feature.properties['VegFrac'], 4) + '<br/>' +

    '</div>';
    return content;
  }
  createPopupHtmlContentSettlements(feature: any) {
    const content = '<div dir="rtl">' + '<strong>' + feature.properties['Muni_Heb'] + '</strong><hr/>' +
    //'<strong>muni: </strong>' + feature.properties['FIRST_Muni'] + '<br/>' +
    '<strong>אוכלוסיה: </strong>' + this.round(feature.properties['pop17'], 0) + '<br/>' +
    //'<strong>city code: </strong>' + feature.properties['CODE'] + '<br/>' +
    '<strong>דירוג כלכלי חברתי: </strong>' + feature.properties['cluster17'] + '<br/>' +
    '<strong>טמפרטורה: </strong>' + this.round(feature.properties['Temperatur']) + '<br/>' +
    '<strong>כיסוי צומח: </strong>' + this.round(feature.properties['VegFrac'], 4) +
    '</div>';
    // const content = '<div dir="ltr">' + '<strong>' + feature.properties['Muni_Heb'] + '</strong><br/>' +
    // //'<strong>muni: </strong>' + feature.properties['FIRST_Muni'] + '<br/>' +
    // '<strong>population: </strong>' + this.round(feature.properties['pop17'], 0) + '<br/>' +
    // '<strong>city code: </strong>' + feature.properties['CODE'] + '<br/>' +
    // '<strong>cluster: </strong>' + feature.properties['cluster17'] + '<br/>' +
    // '<strong>temperature: </strong>' + this.round(feature.properties['Temperatur']) + '<br/>' +
    // '<strong>VegFrac: </strong>' + this.round(feature.properties['VegFrac'], 4) +
    // '</div>';
    return content;
  }

  round(value: number, decimalPlaces = 2) {
    return Math.round(10**decimalPlaces * value) / (10**decimalPlaces);
  }

  saveLastFeature(feature: any) {
    this.state.saveLastFeature(feature);
  }
}



// use this.map.setPaintProperty() to decide which propery defines the colors.
// in mapbox studio do share in draft (or in public) and the STYLE url is then like: STYLE = 'mapbox://styles/evyatark/cllai1mb000pr01pbcvs21vzr/draft';
// id of the layer is 'statistical1-5pcoii' 

/* 
settlements-data features
CODE:3000
EM:21.513227
FIRST_CR_L:"3000"
FIRST_Muni:"Yerushalayim (Jerusalem)"
FIRST_Sug_:"עירייה"
Muni_Heb:"ירושלים"
ObjectID:38
STATUS:0
SlopeT:-10
SqM_Costs:1
Temperatur:36.701257324218766
VegFrac:0.455723200884746
cluster17:3
fid:75
pop17:899119.30451
rank17:38

statistical-areas feature properties:
Female_Tot:16269
Main_Funct:"מגורים"
Male_Total:16040
Pop_Total:32308
Religion_S:"לא יהודי"
Religion_y:"מעורב"
SHEM_YISHU:"ירושלים"
SHEM_YIS_1:"JERUSALEM"
STAT11:2111
Shape__Are:8367866.62695
Shape__Len:12788.8076113
Stat11_Uni:"2111"
VegFrac:0.065905552672548
YISHUV_STA:30002111
age_0_4:4604
age_5_9:4467
age_10_14:4170
age_15_19:3824
age_20_24:2789
age_25_29:2430
age_30_34:1907
age_35_39:1929
age_40_44:1836
age_45_49:1382
age_50_54:988
age_55_59:730
age_60_64:492
age_65_69:330
age_65_up:761
age_70_74:231
age_75_up:200
cluster:1
fid:1140
id:"00000000000000000182"
median_tem:37.63605651855471
name:"ירושלים"
semel_new:30002111
semel_yesu:3000
stat_area:"2111"
*/