import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eraser } from "lucide-react";

const SignatureCanvas = forwardRef(({ onSignatureChange, soldierName }, ref) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      
      setHasSignature(false);
      if (onSignatureChange) onSignatureChange('');
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [onSignatureChange]);

  const getEventPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getEventPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const pos = getEventPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    
    setHasSignature(true);
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    
    if (onSignatureChange) {
      const canvas = canvasRef.current;
      const dataURL = canvas.toDataURL('image/png');
      onSignatureChange(dataURL);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    if (onSignatureChange) onSignatureChange('');
  };
  
  const isEmpty = () => {
    return !hasSignature;
  };

  useImperativeHandle(ref, () => ({
    toDataURL: () => {
        if (isEmpty()) return null;
        return canvasRef.current.toDataURL('image/png');
    },
    clear: clearSignature,
    isEmpty: isEmpty
  }));

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-medium">Digital Signature</Label>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={clearSignature}
          className="text-xs"
        >
          <Eraser className="w-3 h-3 mr-1" />
          Clear
        </Button>
      </div>
      
      <div className="relative w-full">
        <canvas
          ref={canvasRef}
          className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg bg-white cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-400 text-sm">Draw signature above using mouse or touch</p>
          </div>
        )}
      </div>
    </div>
  );
});

export default SignatureCanvas;