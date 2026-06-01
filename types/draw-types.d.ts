declare module '@mapbox/mapbox-gl-draw' {
  import { IControl } from 'mapbox-gl';
  import { Feature, FeatureCollection, Geometry } from 'geojson';

  export interface MapboxDrawOptions {
    displayControlsDefault?: boolean;
    controls?: {
      point?: boolean;
      line_string?: boolean;
      polygon?: boolean;
      trash?: boolean;
      combine_features?: boolean;
      uncombine_features?: boolean;
    };
    styles?: object[];
    keybindings?: boolean;
    touchEnabled?: boolean;
    boxSelect?: boolean;
    clickBuffer?: number;
    touchBuffer?: number;
    modes?: object;
    defaultMode?: string;
  }

  export default class MapboxDraw implements IControl {
    constructor(options?: MapboxDrawOptions);
    add(geojson: Feature | FeatureCollection | Geometry): string[];
    get(featureId: string): Feature | undefined;
    getAll(): FeatureCollection;
    delete(featureIds: string | string[]): this;
    deleteAll(): this;
    set(featureCollection: FeatureCollection): string[];
    getSelectedIds(): string[];
    getSelected(): FeatureCollection;
    getSelectedPoints(): FeatureCollection;
    setMode(mode: string, options?: object): void;
    changeMode(mode: string, options?: object): void;
    getMode(): string;
    trash(): this;
    combineFeatures(): this;
    uncombineFeatures(): this;
    onAdd(map: any): HTMLElement;
    onRemove(map: any): void;
  }
}
