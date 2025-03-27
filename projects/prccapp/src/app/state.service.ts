import { Injectable } from '@angular/core';
import { ReplaySubject } from 'rxjs';
import { ApiService } from './api.service';
import { Legend, State, StateMode } from './states/base-state';
import { MuniState } from './states/muni-state';
import { MunisState } from './states/munis-state';
import { StatAreaState } from './states/stat-area-state';
import { StatAreasState } from './states/stat-areas-state';
import { TreeState } from './states/tree-state';
import { TreesState } from './states/trees-state';
import { TREE_COLOR_LEGEND } from './states/consts-trees';

@Injectable({
  providedIn: 'root'
})
export class StateService {

  state =  new ReplaySubject<State>();
  loading =  new ReplaySubject<void>();

  public sidebarOpened = true;

  lastFeature : any = null;
  treeLegend: Legend;

  constructor(private api: ApiService) { 
    this.treeLegend = TREE_COLOR_LEGEND;

  }
  //constructor() { }

  saveLastFeature(feature: any) {
    this.lastFeature = feature;
  }
  getLastFeature() {
    return this.lastFeature;
  }

  // create a state object when the URL is manually changed (and - when Angular app is first navigated to)
  // for example, when navigating to URL "http://localhost:4200/munis", this method is called
  // with segments[0]="munis". this segments[0] decides the "mode". 
  // The State object is created according to the mode.
  // queryParams usually holds info about the filters (drop-downs in the <filter> area in the <header>) -
  // selecting a value in the drop-downs causes a routing to a "new" URL which includes 
  // a query param representing that drop-down selection!
  initFromUrl(segments: any[], queryParams: any) {
    console.log('initFromUrl STARTED, segments=', segments, 'queryParams=', queryParams);
    let mode = segments[0] as StateMode;
    const id = segments[1] ? decodeURIComponent(segments[1]) : undefined;
    let state: State | null = null;
    if (!mode) {
      mode = 'about';
    }
    console.log('initFromUrl STARTED, mode=', mode);
    if (mode === 'trees') {
      if (id) {
        state = new TreeState(id, queryParams);
      } else {
        state = new TreesState(queryParams);
      }
    }
    if (mode === 'stat-areas') {
      if (id) {
        state = new StatAreaState(id, queryParams);
      } else {
        state = new StatAreasState(queryParams);
      }
    }
    if (mode === 'munis') {
      if (id) {
        state = new MuniState(id, queryParams);
      } else {
        state = new MunisState(queryParams);
      }
    }
    state = state || new State(mode, id, queryParams);
    this.init(state);
  }

  init(state: State) {
    this.loading.next();
    console.log('LOADING STATE');
    state.process(this.api).subscribe(() => {
      console.log('PROCESSED STATE', state);
      this.state.next(state);
    });
  }

}
