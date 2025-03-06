import { Injectable } from '@angular/core';
import * as mapboxgl from 'mapbox-gl';
import { ReplaySubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MapboxService {

  ACCESS_TOKEN = 'pk.eyJ1IjoiaGFzYWRuYSIsImEiOiJjbTdkNGxocGowcDRxMnBzZmZ1dGpmNjJ1In0.4pe9hQ6O4lTToY-Ua2qL3w'; // hasadna account

  public init = new ReplaySubject<void>(1);
  public map: mapboxgl.Map;

  constructor() {
    console.log('MAPBOX SERVICE ACCESS TOKEN', this.ACCESS_TOKEN);
    (mapboxgl.accessToken as any) = this.ACCESS_TOKEN;
    mapboxgl.setRTLTextPlugin(
      'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js',
      (error: any) => {
        console.log('FAILED TO LOAD PLUGIN', error);
      },
      true // Lazy load the plugin
    );  
    this.init.next();
    this.init.complete();
  } 
}
