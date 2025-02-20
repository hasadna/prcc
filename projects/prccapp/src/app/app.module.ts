import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MatTooltipModule } from '@angular/material/tooltip'; 
import {MatSliderModule} from '@angular/material/slider';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LayoutComponent } from './layout/layout.component';
import { HeaderComponent } from './header/header.component';
import { MapComponent } from './map/map.component';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MunisComponent } from './munis/munis.component';
import { MuniComponent } from './muni/muni.component';
import { AboutComponent } from './about/about.component';
import { OdotComponent } from './odot/odot.component';
import { TreesComponent } from './trees/trees.component';
import { StatAreaComponent } from './stat-area/stat-area.component';
import { StatAreasComponent } from './stat-areas/stat-areas.component';
import { RegionComponent } from './region/region.component';
import { SummaryComponent } from './summary/summary.component';
import { LegendComponent } from './legend/legend.component';
import { ContentComponent } from './content/content.component';
import { FilterComponent } from './filter/filter.component';
import { TreeLegendComponent } from './tree-legend/tree-legend.component';


@NgModule({
  declarations: [
    AppComponent,
    AboutComponent,
    OdotComponent,
    HeaderComponent,
    MapComponent,
    ContentComponent,
    MunisComponent,
    MuniComponent,
    FilterComponent,
    TreesComponent,
    StatAreasComponent,
    StatAreaComponent,
    RegionComponent,
    SummaryComponent,
    LegendComponent,
    LayoutComponent,
    TreeLegendComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    MatTooltipModule,
    MatSliderModule,
    HttpClientModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
