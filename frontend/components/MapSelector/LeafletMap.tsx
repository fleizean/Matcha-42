"use client";

import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LeafletMapProps {
  initialLocation: [number, number];
  onLocationSelect: (lat: number, lng: number) => void;
  height: string;
}

export default function LeafletMap({ 
  initialLocation, 
  onLocationSelect,
  height 
}: LeafletMapProps) {
  const mapId = `map-${Math.random().toString(36).substring(2, 9)}`;
  const [selectedLocation, setSelectedLocation] = useState<[number, number]>(initialLocation);
  
  // initialLocation değerini bir ref olarak saklayın, böylece sadece ilk render'da kullanılır
  const initialLocationRef = useRef<[number, number]>(initialLocation);
  
  useEffect(() => {
    let marker: L.Marker;
    let map: L.Map;
    
    const mapContainer = document.getElementById(mapId);
    if (!mapContainer) return;
    
    if (mapContainer.innerHTML !== "") {
      mapContainer.innerHTML = "";
    }
    
    // initialLocationRef.current kullanarak initial pozisyonu ayarlıyoruz
    // Böylece initialLocation prop'u değişse bile başlangıç konumu sabit kalır
    map = L.map(mapId).setView(initialLocationRef.current, 13);
    
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    const icon = L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41]
    });
    
    // Eğer bir önceki seçilen konum varsa onu kullan, yoksa initial konumu kullan
    const startPosition = selectedLocation || initialLocationRef.current;
    marker = L.marker(startPosition, { icon, draggable: true }).addTo(map);
    
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      const newPosition: [number, number] = [lat, lng];
      
      marker.setLatLng(newPosition);
      setSelectedLocation(newPosition);
      onLocationSelect(lat, lng);
    });
    
    marker.on('dragend', () => {
      const newPos = marker.getLatLng();
      const newPosition: [number, number] = [newPos.lat, newPos.lng];
      setSelectedLocation(newPosition);
      onLocationSelect(newPos.lat, newPos.lng);
    });
    
    marker.bindPopup("Bu konumu seçmek için tıklayın veya marker'ı sürükleyin").openPopup();
    
    setTimeout(() => {
      marker.closePopup();
    }, 5000);
    
    return () => {
      if (map) {
        map.remove();
      }
    };
  // initialLocation'ı dependency array'den çıkarın, sadece ilk render'da kullanılmasını sağlayın
  }, [mapId, onLocationSelect, selectedLocation]); 
  
  return (
    <>
      <div 
        id={mapId} 
        style={{ 
          height,
          width: '100%',
          borderRadius: '0.5rem' 
        }}
      />
     
    </>
  );
}