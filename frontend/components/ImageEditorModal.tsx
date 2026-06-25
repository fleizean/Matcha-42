"use client";

import React, { useState, useEffect, useRef } from "react";
import { FiRotateCw, FiCheck, FiX, FiSliders } from "react-icons/fi";

interface ImageEditorModalProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (blob: Blob) => void;
}

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  imageUrl,
  onClose,
  onSave,
}) => {
  const [rotation, setRotation] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [grayscale, setGrayscale] = useState<number>(0);
  const [sepia, setSepia] = useState<number>(0);
  const [blur, setBlur] = useState<number>(0);
  const [invert, setInvert] = useState<number>(0);

  // Crop box state in percentage (1:1 square crop box)
  const [cropSize, setCropSize] = useState<number>(60); // 20% to 100%
  const [cropX, setCropX] = useState<number>(20); // 0% to 100-cropSize
  const [cropY, setCropY] = useState<number>(20); // 0% to 100-cropSize

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const isDragging = useRef<boolean>(false);
  const dragStart = useRef<{ x: number; y: number; cropX: number; cropY: number }>({ x: 0, y: 0, cropX: 0, cropY: 0 });

  // Reset crop position if cropSize changes to keep it inside bounds
  useEffect(() => {
    setCropX((prev) => Math.min(prev, 100 - cropSize));
    setCropY((prev) => Math.min(prev, 100 - cropSize));
  }, [cropSize]);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      cropX: cropX,
      cropY: cropY,
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStart.current.x) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStart.current.y) / rect.height) * 100;

    let newX = dragStart.current.cropX + deltaX;
    let newY = dragStart.current.cropY + deltaY;

    // Constrain within bounds
    newX = Math.max(0, Math.min(newX, 100 - cropSize));
    newY = Math.max(0, Math.min(newY, 100 - cropSize));

    setCropX(newX);
    setCropY(newY);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [cropX, cropY, cropSize]);

  // Touch handlers for mobile devices
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    isDragging.current = true;
    dragStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      cropX: cropX,
      cropY: cropY,
    };
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging.current || !containerRef.current || e.touches.length !== 1) return;

    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = ((e.touches[0].clientX - dragStart.current.x) / rect.width) * 100;
    const deltaY = ((e.touches[0].clientY - dragStart.current.y) / rect.height) * 100;

    let newX = dragStart.current.cropX + deltaX;
    let newY = dragStart.current.cropY + deltaY;

    newX = Math.max(0, Math.min(newX, 100 - cropSize));
    newY = Math.max(0, Math.min(newY, 100 - cropSize));

    setCropX(newX);
    setCropY(newY);
  };

  useEffect(() => {
    const handleTouchEnd = () => {
      isDragging.current = false;
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [cropX, cropY, cropSize]);

  const handleSave = () => {
    const img = imageRef.current;
    if (!img) return;

    // 1. Create a full-resolution canvas for rotated + filtered image
    const canvas1 = document.createElement("canvas");
    const is90or270 = rotation === 90 || rotation === 270;
    const rotatedWidth = is90or270 ? img.naturalHeight : img.naturalWidth;
    const rotatedHeight = is90or270 ? img.naturalWidth : img.naturalHeight;

    canvas1.width = rotatedWidth;
    canvas1.height = rotatedHeight;

    const ctx1 = canvas1.getContext("2d");
    if (!ctx1) return;

    // Apply canvas filters (using standard CSS filters syntax)
    ctx1.filter = `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%) sepia(${sepia}%) blur(${blur}px) invert(${invert}%)`;

    // Draw image with rotation
    ctx1.translate(rotatedWidth / 2, rotatedHeight / 2);
    ctx1.rotate((rotation * Math.PI) / 180);
    ctx1.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    // 2. Crop the image on a second canvas
    const canvas2 = document.createElement("canvas");
    
    // Crop coordinates in pixels on the full rotated resolution
    const pxCropSize = (cropSize / 100) * rotatedWidth;
    const pxCropX = (cropX / 100) * rotatedWidth;
    const pxCropY = (cropY / 100) * rotatedHeight;

    // Set crop size (1:1 square crop box)
    canvas2.width = pxCropSize;
    canvas2.height = pxCropSize;

    const ctx2 = canvas2.getContext("2d");
    if (!ctx2) return;

    ctx2.drawImage(
      canvas1,
      pxCropX,
      pxCropY,
      pxCropSize,
      pxCropSize,
      0,
      0,
      pxCropSize,
      pxCropSize
    );

    // 3. Export to Blob and save
    canvas2.toBlob(
      (blob) => {
        if (blob) {
          onSave(blob);
        }
      },
      "image/jpeg",
      0.9
    );
  };

  // Preview styling
  const filterStyle = {
    filter: `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%) sepia(${sepia}%) blur(${blur}px) invert(${invert}%)`,
    transform: `rotate(${rotation}deg)`,
    transition: "transform 0.2s ease, filter 0.1s ease",
  };

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl w-full max-w-4xl overflow-hidden flex flex-col md:grid md:grid-cols-[1fr_300px] h-[90vh] max-h-[750px] shadow-2xl">
        
        {/* Left Side: Image Preview & Cropper */}
        <div className="relative flex-1 bg-[#121214] p-6 flex items-center justify-center border-b border-[#2C2C2E] md:border-b-0 md:border-r">
          <div 
            ref={containerRef}
            className="relative overflow-hidden select-none max-w-full max-h-[40vh] md:max-h-[60vh] aspect-square flex items-center justify-center"
            style={{ width: "400px", height: "400px" }}
          >
            {/* The Image to edit */}
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Edit Preview"
              style={filterStyle}
              className="max-w-full max-h-full object-contain pointer-events-none"
              crossOrigin="anonymous"
            />

            {/* Draggable Crop Box Overlay */}
            <div
              className="absolute border-2 border-dashed border-[#D63384] cursor-move bg-black/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
              style={{
                left: `${cropX}%`,
                top: `${cropY}%`,
                width: `${cropSize}%`,
                height: `${cropSize}%`,
              }}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
            >
              {/* Corner indicators */}
              <div className="absolute -top-1 -left-1 w-3 h-3 bg-[#D63384]"></div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#D63384]"></div>
              <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-[#D63384]"></div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#D63384]"></div>
            </div>
          </div>
        </div>

        {/* Right Side: Editors & Sliders Controls */}
        <div className="p-6 overflow-y-auto flex flex-col justify-between h-full bg-[#1C1C1E]">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FiSliders className="text-[#D63384]" /> Görsel Düzenleyici
              </h3>
              <button 
                onClick={onClose} 
                className="text-gray-400 hover:text-white p-1 hover:bg-[#2C2C2E] rounded-full transition-colors"
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Rotation Control */}
            <div>
              <button
                onClick={handleRotate}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[#2C2C2E] hover:bg-[#3C3C3E] text-white rounded-lg font-medium transition-colors border border-[#3C3C3E]"
              >
                <FiRotateCw /> 90° Döndür
              </button>
            </div>

            {/* Crop Size Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-300">
                <span>Kırpma Alanı Boyutu</span>
                <span className="font-semibold">{cropSize}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                value={cropSize}
                onChange={(e) => setCropSize(Number(e.target.value))}
                className="w-full h-1.5 bg-[#2C2C2E] rounded-lg appearance-none cursor-pointer accent-[#D63384]"
              />
            </div>

            <hr className="border-[#2C2C2E]" />

            {/* Filters Sliders */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Filtreler</h4>

              {/* Brightness */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-300">
                  <span>Parlaklık</span>
                  <span>{brightness}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full h-1 bg-[#2C2C2E] rounded-lg appearance-none cursor-pointer accent-[#D63384]"
                />
              </div>

              {/* Contrast */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-300">
                  <span>Kontrast</span>
                  <span>{contrast}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full h-1 bg-[#2C2C2E] rounded-lg appearance-none cursor-pointer accent-[#D63384]"
                />
              </div>

              {/* Grayscale */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-300">
                  <span>Siyah-Beyaz</span>
                  <span>{grayscale}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={grayscale}
                  onChange={(e) => setGrayscale(Number(e.target.value))}
                  className="w-full h-1 bg-[#2C2C2E] rounded-lg appearance-none cursor-pointer accent-[#D63384]"
                />
              </div>

              {/* Sepia */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-300">
                  <span>Eski Fotoğraf (Sepia)</span>
                  <span>{sepia}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sepia}
                  onChange={(e) => setSepia(Number(e.target.value))}
                  className="w-full h-1 bg-[#2C2C2E] rounded-lg appearance-none cursor-pointer accent-[#D63384]"
                />
              </div>

              {/* Blur */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-300">
                  <span>Bulanıklık</span>
                  <span>{blur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={blur}
                  onChange={(e) => setBlur(Number(e.target.value))}
                  className="w-full h-1 bg-[#2C2C2E] rounded-lg appearance-none cursor-pointer accent-[#D63384]"
                />
              </div>

              {/* Invert */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-300">
                  <span>Renkleri Ters Çevir</span>
                  <span>{invert}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={invert}
                  onChange={(e) => setInvert(Number(e.target.value))}
                  className="w-full h-1 bg-[#2C2C2E] rounded-lg appearance-none cursor-pointer accent-[#D63384]"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-[#2C2C2E]">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-[#2C2C2E] hover:bg-[#3C3C3E] text-white rounded-xl font-medium transition-colors border border-[#3C3C3E]"
            >
              Vazgeç
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 px-4 bg-[#D63384] hover:bg-[#E03A90] text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#D63384]/20"
            >
              <FiCheck /> Kaydet
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
