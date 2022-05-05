/* eslint-disable max-len */

/* eslint-disable no-bitwise */
/* eslint-disable @typescript-eslint/naming-convention */
import { Component, ElementRef, ViewChild } from '@angular/core';
import { Map } from 'maplibre-gl';
import * as maplibregl from 'maplibre-gl';
import * as nextbillion from 'nbmap-gl';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})


export class HomePage {
  @ViewChild('map', {static: false}) mapElement: ElementRef;
  map: maplibregl.Map;
  originMarker: maplibregl.Marker;
  destinationMarker: maplibregl.Marker;
  popup: maplibregl.Popup;
  firstSymbolId: string;

  constructor() {}

  // eslint-disable-next-line @angular-eslint/use-lifecycle-interface
  ngOnInit() {
    this.loadMap();
  }

  private loadMap() {
    this.map = new Map({
        container: 'map', // container id
        style: 'https://api.nextbillion.io/maps/streets/style.json?key=YOUR_API_KEY',
        center: [-83.1264, 40.11959],
        zoom: 12
    });

    // Required for using NB.ai services - directions, distance matrix, search
    nextbillion.default.setApiHost('api.nextbillion.io');
    nextbillion.default.setApiKey('YOUR_API_KEY');
    this.map.resize();
    this.map.on('load', (e) => {
      this.nbLogo();
    });

    this.map.on('click', e => {
      if (!this.originMarker) {
        this.originMarker = new maplibregl.Marker({
          draggable: true,
          scale: .6,
          color: 'green'
        }).setLngLat([e.lngLat.lng, e.lngLat.lat]).addTo(this.map);
        this.originMarker.on('dragend', (_) => {
          this.routeMe();
        });
      } else if (!this.destinationMarker) {
        this.destinationMarker = new maplibregl.Marker({
          draggable: true,
          scale: .6,
          color: 'red'
        }).setLngLat([e.lngLat.lng, e.lngLat.lat]).addTo(this.map);
        this.destinationMarker.on('dragend', (_blank) => {
          this.routeMe();
        });
      }
      this.routeMe();
    });
  }

  private async routeMe() {
    if (this.originMarker && this.destinationMarker) {
      const resp = await nextbillion.default.api.Directions({
        origin: {lat: this.originMarker.getLngLat().lat, lng: this.originMarker.getLngLat().lng},
        destination: {lat: this.destinationMarker.getLngLat().lat, lng: this.destinationMarker.getLngLat().lng},
        mode: '4w',
        steps: true
      });

      if (this.popup) {
        this.popup.remove();
      }
      this.popup = new maplibregl.Popup({anchor: 'bottom', offset: [0,-45]})
        .setLngLat(this.destinationMarker.getLngLat())
        .setHTML(
          `<h3 style=color:purple>${(resp.routes[0].distance/1000.0).toFixed(1)} km<br>
          ${(resp.routes[0].duration/60.0).toFixed(1)} min</h3>`)
        .setMaxWidth('300px')
        .addTo(this.map);

      const coords = this.decodePolyline(resp.routes[0].geometry, 5);
      const start = coords[0];
      const end = coords[coords.length - 1];

      const layers = this.map.getStyle().layers;
      for (const layer of layers) {
        if (layer.type === 'symbol') {
          this.firstSymbolId = layer.id;
          break;
        }
      }
      if (!this.map.getSource('route')) {
        this.map.addSource('route', {
        type: 'geojson',
        lineMetrics: true,
        data: null
      });
    }
    const source = this.map.getSource('route') as maplibregl.GeoJSONSource;
    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: coords.map(item => ([item[1],item[0]]))
          }
        }
      ]
    });

    // clear any prior routes
    [-1, 0, 1, 0].forEach((x, i) => {
      if (this.map.getLayer('routeOutline-'+i)) {
        this.map.removeLayer('routeOutline-'+i);
      }
    });

    // render route and outline
    [-1, 0, 1, 0].forEach((x, i) => {
      this.map.addLayer({
        type: 'line',
        source: 'route',
        id: 'routeOutline-'+i,
        paint: {
          'line-color': i === 3 ? 'lightgreen' : 'black',
          'line-width': i === 3 ? 6 : 3,
          'line-offset': x * 3
        },
        layout: {
          'line-cap': i === 3 ? 'butt': 'square'
        }
      }, this.firstSymbolId);
    });



    }
  }

  private decodePolyline(str, precision) {
    let index = 0;
      let lat = 0;
      let lng = 0;
      const coordinates = [];
      let shift = 0;
      let result = 0;
      let byte = null;
      let latitude_change;
      let longitude_change;
      const factor = Math.pow(10, Number.isInteger(precision) ? precision : 5);

    // Coordinates have variable length when encoded, so just keep
    // track of whether we've hit the end of the string. In each
    // loop iteration, a single coordinate is decoded.
    while (index < str.length) {
      // Reset shift, result, and byte
      byte = null;
      shift = 0;
      result = 0;

      do {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      latitude_change = result & 1 ? ~(result >> 1) : result >> 1;

      shift = result = 0;

      do {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      longitude_change = result & 1 ? ~(result >> 1) : result >> 1;

      lat += latitude_change;
      lng += longitude_change;

      coordinates.push([lat / factor, lng / factor]);
    }

    return coordinates;
  }

  private nbLogo() {
    const holderDiv = document.createElement('div');
    holderDiv.innerHTML = `<a href="https://www.nextbillion.ai" target="_blank" style="position:absolute; left:10px; bottom:10px; z-index:999;">
    <img src='https://d12qcqjlhp2ahm.cloudfront.net/maps-logo.svg'/></a>`;
    const mapElement = document.getElementById('map');
    mapElement.appendChild(holderDiv);
  }



}


