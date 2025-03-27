import { Component, Input, OnChanges } from '@angular/core';
import { StateService } from '../state.service';
import { MatSliderModule } from '@angular/material/slider';

type IconInfo = {
  field?: string;
  text: string;
  icon: string;
  tooltip?: string;
  value?: string | ((record: any) => string | null);
  units?: string | ((record: any) => string);
};

const ICON_INFOS: IconInfo[] = [
  // these 2 icons use fields in the muni record
  {
    text: 'טמפרטורת פני השטח',
    icon: 'temperature',
    tooltip: 'לפי נתוני למ״ס 2020',
    units: 'מעלות',
    field: 'Temperatur',
    //value: (row) => "45",
  },
  {
    text: 'מדד סוציואקונומי',
    icon: 'madad',
    tooltip: 'לפי נתוני למ״ס 2020',
    units: '',
    field: 'cluster17',
    //value: (row) => "8",
  },
  // these 2 icons use fields in the stat-area record
  {
    text: 'טמפרטורת פני השטח',
    icon: 'temperature',
    tooltip: 'לפי נתוני למ״ס 2020',
    units: 'מעלות',
    field: 'median_tem',
    //value: (row) => "45",
  },
  {
    text: 'מדד סוציואקונומי',
    icon: 'madad',
    tooltip: 'לפי נתוני למ״ס 2020',
    units: '',
    field: 'cluster',
    //value: (row) => "8",
  },
  // shadowing score currently not calculated 
  // TODO: when it will be, you may need to calculate differently for muni and for stat-area!!
  {
    text: 'ציון הצללה משוקלל',
    icon: 'shadowing-score',
    tooltip: 'בקרוב...',
    units: '',
    value: (row) => "--",
  },
];

const ICON_INFOS2: IconInfo[] = [
  {
    text: 'כיסוי נוכחי',
    icon: 'current-cover',
    tooltip: 'לפי נתוני למ״ס 2020',
    units: '',
    //field: 'VegFrac',
    value: (row) => (row.VegFrac * 100).toFixed(0) + '%',
    //value: "2%",
  },
  {
    text: 'כיסוי לאחר התערבות',
    icon: 'expected-cover',
    tooltip: 'הזז את הסקרול לתוצאות',
    units: '',
    value: (row) => '?',
  },
];

const ICON_INFOS3: IconInfo[] = [
  {
    text: 'שינוי בטמפרטורה',
    icon: 'temperature-change',
    tooltip: 'הזז את הסקרול לתוצאות',
    units: 'מעלות',
    value: '0',
  },
  {
    text: 'השפעת התערבות על המחיר למ"ר',
    icon: 'savings',
    tooltip: 'הזז את הסקרול לתוצאות',
    units: 'שח',
    value: '--',
  },
  {
    text: 'מניעת תחלואה',
    icon: 'prevent-sickness',
    tooltip: 'הזז את הסקרול לתוצאות',
    units: 'בשנה',
    value: '--',
  },
  {
    text: 'מניעת תמותה מוקדמת',
    icon: 'prevent-death',
    tooltip: 'הזז את הסקרול לתוצאות',
    units: 'בשנה',
    value: '0',
  },
];

@Component({
  selector: 'app-region',
  templateUrl: './region.component.html',
  styleUrls: ['./region.component.less'],
  // standalone: true,
  // imports: [MatSliderModule],
})
export class RegionComponent implements OnChanges {
  @Input() record: any = null;
  @Input() sources: any[] = [];
  @Input() name: string = '';
  @Input() focus: string = '';
  @Input() focusLink: string = '';

  iconInfos: IconInfo[] = [];
  iconInfos2: IconInfo[] = [];
  iconInfos3: IconInfo[] = ICON_INFOS3;
  focusParams: any = {};
  nameOfRegion: String = 'unknown'; // region could be Muni or Stat-Area - depending on which view we are in!!
  minVal: number = 0

  constructor(public state: StateService) {}

  ngOnChanges(): void {
    console.log('ngOnChange started');
    if (this.record) {
      console.log('REGION RECORD', this.record);
      const lastFeature = this.state.getLastFeature();
      console.log('LAST FEATURE', lastFeature);
      
      if (lastFeature) {
        // according to feature.layer.id we know if we are in stat-area or in muni
        if (lastFeature.layer.id === "prcc-settlements-data") {
          this.nameOfRegion = lastFeature.properties['Muni_Heb'];
        }
        else if (lastFeature.layer.id === "prcc-statistical-areas") {
          this.nameOfRegion = lastFeature.properties['SHEM_YISHU'] + " " + "איזור" + " " + lastFeature.properties['stat_area'];
        }
        // Hack here: I use data from lastFeature instead of record!!
        this.record = lastFeature.properties;
      }
      this.iconInfos = [];
      ICON_INFOS.forEach((iconInfo) => {
        this.populateIconInfo(iconInfo, this.iconInfos);
      });
      ICON_INFOS2.forEach((iconInfo) => {
        this.populateIconInfo(iconInfo, this.iconInfos2);
      });
      console.log('REGION ICON_INFOS', this.iconInfos);
      console.log('REGION ICON_INFOS2', this.iconInfos2);
      // iconInfo3
      this.iconInfos3[0].value = '--';
      this.iconInfos3[1].value = '--';
      this.iconInfos3[2].value = '--';
      this.iconInfos3[3].value = '--';
  

      this.focusParams = {
        focus: this.focus,
      };

      // save initial value of slider, to be used in onDragEnd
      this.minVal = Math.round(100* this.record.VegFrac);
    }
      
  }

  populateIconInfo(iconInfo: any, theArray: any[]) {
    let value: any | null = null;
    if (iconInfo.field) {
      value = this.record[iconInfo.field];
    } else if (typeof iconInfo.value === 'function') {
      value = iconInfo.value(this.record);
    }
    let units = iconInfo.units;
    if (typeof units === 'function') {
      units = units(this.record);
    }
    if (value !== null && value !== undefined && units !== null && units !== undefined) {
      if (typeof value === 'number') {
        value = value.toLocaleString();
      }
      //this.iconInfos.push({
      theArray.push({
        text: iconInfo.text,
        icon: iconInfo.icon,
        tooltip: iconInfo.tooltip,
        value, units,
      });
    }
  }

  // This is for the slider, see https://material.angular.io/components/slider/examples#slider-formatting
  formatLabel(value: number): string {
    if (value >= -1) {
      return Math.round(value) + '%';
    }

    return `${value}`;
  }

  // this method is called every time the slider value changes (only when draging with the mouse, not when using keyboard!)
  onDragEnd(event: any) {
    console.log('event dragEnd', event);
    console.log('slider value is now', event.value);
    console.log('minimal value is', this.minVal);
    if (Math.abs(event.value - this.minVal) < 0.5) {
      this.iconInfos2[1].value = event.value.toFixed(0) + '%';
      this.iconInfos3[0].value = '--';
      this.iconInfos3[1].value = '--';
      this.iconInfos3[2].value = '--';
      this.iconInfos3[3].value = '--';
    }
    else {
      // hack - access iconInfos2 by index, assuming a known structure!!
      const aoc = this.calculate_aoc(event.value);
      const sqm = this.record.SqM_Costs;
      const temperature_change = this.calculate_Temperature_change(event.value);
      const house_price = this.calculate_hause_price(event.value);
      const sickness = this.calculate_sickness(event.value);
      this.iconInfos2[1].value = event.value.toFixed(0) + '%';
      this.iconInfos3[0].value = String(temperature_change);
      this.iconInfos3[1].value = String(house_price);
      this.iconInfos3[2].value = String(sickness);
      this.iconInfos3[3].value = String(aoc);
    }
  }

  calculate_sickness(slider_val_percents: number) {
    const current_vegFrac = this.record.VegFrac;
    const slider_val = slider_val_percents * 0.01 ;
    const deltaVegFrac = slider_val - current_vegFrac;

    const cancerFactors = [-3.222, -4.399, -3.8, -3.996, -5.237]
    
    //const deltaNvdi = this.record.EM * deltaVegFrac + 0.0579; // <== is this the correct calculation? using EM?
    const deltaNvdi = 0.3616 * deltaVegFrac + 0.0579;           // or like this?

    const rri1 = Math.exp(cancerFactors[0] * deltaNvdi);
    const aoc1 = ((rri1 - 1) / rri1) * this.record["EM Breast Cancer"];

    const rri2 = Math.exp(cancerFactors[1] * deltaNvdi);
    const aoc2 = ((rri2 - 1) / rri2) * this.record["EM Lung Cancer"];

    const rri3 = Math.exp(cancerFactors[2] * deltaNvdi);
    const aoc3 = ((rri3 - 1) / rri3) * this.record["EM Melanoma"];

    const rri4 = Math.exp(cancerFactors[3] * deltaNvdi);
    const aoc4 = ((rri4 - 1) / rri4) * this.record["EM Prostate Cancer"];

    const rri5 = Math.exp(cancerFactors[4] * deltaNvdi);
    const aoc5 = ((rri5 - 1) / rri5) * this.record["EM Shalpoochit Hashetten Cancer"]; 

    const aoc = (-1 * (aoc1 + aoc2 + aoc3 + aoc4 + aoc5)).toFixed(2) ;
    
    console.log("==> calculate_sickness, slider_val_percents=", slider_val_percents );
    console.log('current_vegFrac=', current_vegFrac);
    console.log('slider_val=', slider_val);
    console.log('deltaVegFrac=', deltaVegFrac);
    console.log('deltaNvdi=', deltaNvdi);

    console.log('rri1=', rri1);
    console.log('aoc1=', aoc1);
    console.log('rri2=', rri2);
    console.log('aoc2=', aoc2);
    console.log('rri3=', rri3);
    console.log('aoc3=', aoc3);
    console.log('rri4=', rri4);
    console.log('aoc4=', aoc4);
    console.log('rri5=', rri5);
    console.log('aoc5=', aoc5);

    console.log('aoc=', aoc);

    return aoc;
  }

  calculate_hause_price(slider_val_percents: number) {
    const current_vegFrac = this.record.VegFrac;
    const slider_val = slider_val_percents * 0.01 ;
    const deltaVegFrac = slider_val - current_vegFrac;
    const deltaNvdi = 0.3616 * deltaVegFrac + 0.0579

    const cluster_factor_table = [];
    const values = [0.0, 1.0216, 1.0216, 1.0135, 1.0135, 1.0141, 1.0141, 1.0116, 1.0116, 1.0158, 1.0158]
    for (let i = 0; i < 11; i++) {
      cluster_factor_table.push(values[i]);
    }

    const SA_mean_housing_value = this.record['Average Cost Per Sqm']
    //const Area_Hezi = this.record['mr_Banooy']

    const housing_value_change_exact = SA_mean_housing_value * deltaNvdi * cluster_factor_table[this.record.cluster];
    const housing_value_change = housing_value_change_exact.toFixed(2);

    console.log("==> calculate_hause_price, slider_val_percents=", slider_val_percents );
    console.log('current_vegFrac=', current_vegFrac);
    console.log('slider_val=', slider_val);
    console.log('deltaVegFrac=', deltaVegFrac);
    console.log('deltaNvdi=', deltaNvdi);
    console.log('SA_mean_housing_value=', SA_mean_housing_value);
    //console.log('Area_Hezi=', Area_Hezi);
    console.log('this.record.cluster=', this.record.cluster);
    console.log('cluster factor=', cluster_factor_table[this.record.cluster]);
    console.log('housing_value_change=', housing_value_change);

    return housing_value_change;
  }

  calculate_Temperature_change(slider_val_percents: number) {
    const current_vegFrac = this.record.VegFrac;
    const slider_val = slider_val_percents * 0.01 ;
    const deltaVegFrac = slider_val - current_vegFrac;
    //const deltaNvdi = 0.3616 * deltaVegFrac + 0.0579

    //const slopet = this.record.SlopeT;
    const slopet = -2.814;  // instead of using the value from polygon, always use this constant value!
    
    const temperature_change = (-1 * slopet * deltaVegFrac).toFixed(2);
    console.log("==> calculate_Temperature_change, slider_val_percents=", slider_val_percents );
    console.log('current_vegFrac=', current_vegFrac);
    console.log('slider_val=', slider_val);
    console.log('deltaVegFrac=', deltaVegFrac);
    //console.log('deltaNvdi=', deltaNvdi);
    console.log('slopet=', slopet);
    console.log('temperature_change=', temperature_change);
    return temperature_change;
  }

  calculate_aoc(slider_val_percents: number) {
    const current_vegFrac = this.record.VegFrac;
    const slider_val = slider_val_percents * 0.01 ;
    const deltaVegFrac = slider_val - current_vegFrac;
    const deltaNvdi = 0.3616 * deltaVegFrac + 0.0579
    const rri = Math.exp(-0.4082 * deltaNvdi);
    const pafi = (rri - 1) / rri ;
    const em = this.record.EM ;
    const aoc = (-1 * pafi * em).toFixed(2) ;
    console.log("==> calculate_aoc, slider_val_percents=", slider_val_percents );
    console.log('current_vegFrac=', current_vegFrac);
    console.log('slider_val=', slider_val);
    console.log('deltaVegFrac=', deltaVegFrac);
    console.log('deltaNvdi=', deltaNvdi);
    console.log('rri=', rri);
    console.log('pafi=', pafi);
    console.log('em=', em);
    console.log('aoc=', aoc);
    return aoc;
  }
}
