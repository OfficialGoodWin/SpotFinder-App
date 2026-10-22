import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import {createTrafficPopupContent, createAdminPoiPopupContent} from '../../../src/lib/mapPopupContent.js';

export async function mountPopupFixture() {
  maplibregl.setWorkerUrl(workerUrl);
  const container=document.createElement('div');
  container.id='popup-map-fixture';
  container.style.cssText='position:fixed;z-index:9999;left:250px;top:90px;width:400px;height:320px;border:2px solid #111;background:#eef';
  document.body.append(container);
  const map=new maplibregl.Map({container,center:[0,0],zoom:1,style:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#eef'}}]}});
  await new Promise(resolve => map.once('load',resolve));
  const special='<example> & "quoted text"';
  const makeMarker=(label,coordinates,content) => {
    const button=document.createElement('button');
    button.type='button'; button.textContent=label;
    button.style.cssText='padding:5px;background:white;border:1px solid black;font:12px sans-serif';
    return new maplibregl.Marker({element:button})
      .setLngLat(coordinates)
      .setPopup(new maplibregl.Popup({offset:10}).setDOMContent(content))
      .addTo(map);
  };
  const traffic=makeMarker('Traffic fixture',[-20,0],createTrafficPopupContent('works',{roadNumbers:[special],from:special,to:special}));
  const admin=makeMarker('Admin fixture',[20,0],createAdminPoiPopupContent({name:special,street:special},{key:'custom',name:'Custom',color:'#15803d'}));
  return {map,traffic,admin};
}
