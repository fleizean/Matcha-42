"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface UserProfile {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  gender: string;
  sexual_preference: string;
  biography: string;
  latitude: number;
  longitude: number;
  fame_rating: number;
  birth_date: string;
  age?: number;
  distance?: number;
  has_liked?: boolean;
  pictures: {
    id: string;
    backend_url: string;
    is_primary: boolean;
  }[];
}

interface UsersMapProps {
  users: UserProfile[];
  currentUserLocation: [number, number];
  onLikeUser: (userId: string) => Promise<boolean>;
  height?: string;
}

export default function UsersMap({
  users,
  currentUserLocation,
  onLikeUser,
  height = "600px",
}: UsersMapProps) {
  const mapId = `users-map-${Math.random().toString(36).substring(2, 9)}`;
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const mapContainer = document.getElementById(mapId);
    if (!mapContainer) return;

    if (mapContainer.innerHTML !== "") {
      mapContainer.innerHTML = "";
    }

    // Initialize Leaflet Map centered on current user's location
    const map = L.map(mapId).setView(currentUserLocation, 12);
    mapRef.current = map;

    // Use a premium Dark Mode tile layer (CartoDB Dark Matter) which fits our design theme
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20
    }).addTo(map);

    // Leaflet marker shadow
    const shadowUrl = "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-shadow.png";

    // Icon for current user (Green)
    const currentUserIcon = L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Icon for matches (Red)
    const matchUserIcon = L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Add marker for current user
    const currentMarker = L.marker(currentUserLocation, { icon: currentUserIcon }).addTo(map);
    currentMarker.bindPopup('<div class="text-black font-semibold">Sen Buradasın</div>');

    // Add markers for matches
    users.forEach((user) => {
      if (!user.latitude || !user.longitude) return;

      const marker = L.marker([user.latitude, user.longitude], { icon: matchUserIcon }).addTo(map);

      // Create Popup DOM Element
      const popupContent = document.createElement("div");
      popupContent.style.width = "200px";
      popupContent.style.color = "#ffffff";
      popupContent.style.fontFamily = "sans-serif";

      // 1. Photo
      const avatarUrl = user.pictures.find((p) => p.is_primary)?.backend_url || "/images/defaults/man-default.png";
      const img = document.createElement("img");
      img.src = avatarUrl;
      img.style.width = "100%";
      img.style.height = "120px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "8px";
      img.style.marginBottom = "8px";
      popupContent.appendChild(img);

      // 2. User Info
      const info = document.createElement("div");
      info.style.fontWeight = "bold";
      info.style.fontSize = "14px";
      info.style.marginBottom = "2px";
      info.style.color = "#ffffff";
      info.innerText = `${user.first_name} ${user.last_name}${user.age ? `, ${user.age}` : ""}`;
      popupContent.appendChild(info);

      // 3. Distance & Fame
      const stats = document.createElement("div");
      stats.style.fontSize = "12px";
      stats.style.color = "#a1a1aa";
      stats.style.marginBottom = "8px";
      stats.innerText = `${user.distance ? `${user.distance.toFixed(1)} km` : "Yakınlarda"} • ⭐ ${user.fame_rating.toFixed(1)}`;
      popupContent.appendChild(stats);

      // 4. Buttons Container
      const btnContainer = document.createElement("div");
      btnContainer.style.display = "flex";
      btnContainer.style.gap = "8px";

      // View Profile Button
      const viewBtn = document.createElement("a");
      viewBtn.href = `/profile/${user.username}`;
      viewBtn.style.flex = "1";
      viewBtn.style.textAlign = "center";
      viewBtn.style.backgroundColor = "#374151";
      viewBtn.style.color = "#ffffff";
      viewBtn.style.fontSize = "12px";
      viewBtn.style.padding = "6px 0";
      viewBtn.style.borderRadius = "6px";
      viewBtn.style.textDecoration = "none";
      viewBtn.style.fontWeight = "bold";
      viewBtn.style.cursor = "pointer";
      viewBtn.innerText = "Profil";
      btnContainer.appendChild(viewBtn);

      // Like Button
      const likeBtn = document.createElement("button");
      likeBtn.style.flex = "1";
      likeBtn.style.fontSize = "12px";
      likeBtn.style.padding = "6px 0";
      likeBtn.style.borderRadius = "6px";
      likeBtn.style.fontWeight = "bold";
      likeBtn.style.color = "#ffffff";
      likeBtn.style.border = "none";
      likeBtn.style.cursor = "pointer";
      likeBtn.style.transition = "background-color 0.2s";

      const setLikedState = (liked: boolean) => {
        if (liked) {
          likeBtn.style.backgroundColor = "#ef4444";
          likeBtn.innerText = "Beğenildi";
        } else {
          likeBtn.style.backgroundColor = "#D63384";
          likeBtn.innerText = "Beğen";
        }
      };

      setLikedState(!!user.has_liked);

      likeBtn.onclick = async () => {
        likeBtn.disabled = true;
        const success = await onLikeUser(user.id);
        likeBtn.disabled = false;
        if (success) {
          user.has_liked = !user.has_liked;
          setLikedState(!!user.has_liked);
        }
      };

      btnContainer.appendChild(likeBtn);
      popupContent.appendChild(btnContainer);

      // Bind custom popup element to marker
      marker.bindPopup(popupContent);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [users, currentUserLocation, onLikeUser, mapId]);

  return (
    <div
      id={mapId}
      style={{
        height,
        width: "100%",
        borderRadius: "1rem",
        border: "1px solid #2d2d30",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
      }}
      className="leaflet-dark-container"
    />
  );
}
