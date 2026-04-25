import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface BodyMapProps {
  mode: 'interactive' | 'readonly';
  initialData?: Record<string, number>;
  onChange?: (data: Record<string, number>) => void;
}

const getScoreColor = (score: number) => {
  if (score <= 3) return '#D9B29C';
  if (score <= 6) return '#F5A623';
  return '#C0392B';
};

const FRONT_REGIONS = [
  { id: 'f_head', name: 'Head', cx: 90, cy: 35, path: 'M 70,15 Q 90,5 110,15 Q 115,35 110,55 Q 105,65 90,65 Q 75,65 70,55 Q 65,35 70,15 Z' },
  { id: 'f_neck', name: 'Neck', cx: 90, cy: 72, path: 'M 82,65 L 98,65 Q 100,75 110,80 L 70,80 Q 80,75 82,65 Z' },
  { id: 'f_l_shoulder', name: 'Left Shoulder', cx: 125, cy: 95, path: 'M 110,80 Q 125,80 135,95 Q 140,110 120,115 L 105,110 Q 110,95 110,80 Z' },
  { id: 'f_r_shoulder', name: 'Right Shoulder', cx: 55, cy: 95, path: 'M 70,80 Q 55,80 45,95 Q 40,110 60,115 L 75,110 Q 70,95 70,80 Z' },
  { id: 'f_chest', name: 'Chest', cx: 90, cy: 110, path: 'M 70,80 L 110,80 Q 120,100 120,140 Q 90,145 60,140 Q 60,100 70,80 Z' },
  { id: 'f_l_u_arm', name: 'Left Upper Arm', cx: 135, cy: 140, path: 'M 135,95 Q 150,130 145,170 L 125,170 Q 120,130 120,115 L 135,95 Z' },
  { id: 'f_r_u_arm', name: 'Right Upper Arm', cx: 45, cy: 140, path: 'M 45,95 Q 30,130 35,170 L 55,170 Q 60,130 60,115 L 45,95 Z' },
  { id: 'f_l_forearm', name: 'Left Forearm', cx: 140, cy: 205, path: 'M 145,170 Q 155,210 150,240 L 130,240 Q 125,210 125,170 Z' },
  { id: 'f_r_forearm', name: 'Right Forearm', cx: 40, cy: 205, path: 'M 35,170 Q 25,210 30,240 L 50,240 Q 55,210 55,170 Z' },
  { id: 'f_l_hand', name: 'Left Hand & Fingers', cx: 145, cy: 260, path: 'M 150,240 Q 155,260 150,275 Q 140,285 135,275 Q 130,260 130,240 Z' },
  { id: 'f_r_hand', name: 'Right Hand & Fingers', cx: 35, cy: 260, path: 'M 30,240 Q 25,260 30,275 Q 40,285 45,275 Q 50,260 50,240 Z' },
  { id: 'f_u_abd', name: 'Upper Abdomen', cx: 90, cy: 165, path: 'M 60,140 Q 90,145 120,140 L 115,185 Q 90,190 65,185 Z' },
  { id: 'f_l_abd', name: 'Lower Abdomen', cx: 90, cy: 205, path: 'M 65,185 Q 90,190 115,185 L 120,230 Q 90,235 60,230 Z' },
  { id: 'f_groin', name: 'Groin/Pelvis', cx: 90, cy: 245, path: 'M 75,231 Q 90,235 105,231 L 95,260 L 85,260 Z' },
  { id: 'f_l_hip', name: 'Left Hip (outer)', cx: 125, cy: 245, path: 'M 120,230 Q 135,245 130,265 L 95,260 L 105,231 Q 115,230 120,230 Z' },
  { id: 'f_r_hip', name: 'Right Hip (outer)', cx: 55, cy: 245, path: 'M 60,230 Q 45,245 50,265 L 85,260 L 75,231 Q 65,230 60,230 Z' },
  { id: 'f_l_thigh', name: 'Left Upper Thigh', cx: 115, cy: 300, path: 'M 130,265 Q 145,300 135,335 L 95,335 Q 85,300 95,260 Z' },
  { id: 'f_r_thigh', name: 'Right Upper Thigh', cx: 65, cy: 300, path: 'M 50,265 Q 35,300 45,335 L 85,335 Q 95,300 85,260 Z' },
  { id: 'f_l_knee', name: 'Left Knee', cx: 115, cy: 347, path: 'M 135,335 L 95,335 Q 93,347 98,360 L 132,360 Q 137,347 135,335 Z' },
  { id: 'f_r_knee', name: 'Right Knee', cx: 65, cy: 347, path: 'M 45,335 L 85,335 Q 87,347 82,360 L 48,360 Q 43,347 45,335 Z' },
  { id: 'f_l_shin', name: 'Left Shin', cx: 115, cy: 382, path: 'M 132,360 L 98,360 Q 95,385 100,405 L 125,405 Q 130,385 132,360 Z' },
  { id: 'f_r_shin', name: 'Right Shin', cx: 65, cy: 382, path: 'M 48,360 L 82,360 Q 85,385 80,405 L 55,405 Q 50,385 48,360 Z' },
  { id: 'f_l_foot', name: 'Left Ankle & Foot', cx: 115, cy: 412, path: 'M 125,405 L 100,405 Q 90,418 100,418 L 135,418 Q 140,415 125,405 Z' },
  { id: 'f_r_foot', name: 'Right Ankle & Foot', cx: 65, cy: 412, path: 'M 55,405 L 80,405 Q 90,418 80,418 L 45,418 Q 40,415 55,405 Z' },
];

const BACK_REGIONS = [
  { id: 'b_head', name: 'Head (back)', cx: 90, cy: 35, path: 'M 70,15 Q 90,5 110,15 Q 115,35 110,55 Q 105,65 90,65 Q 75,65 70,55 Q 65,35 70,15 Z' },
  { id: 'b_neck', name: 'Neck (back)', cx: 90, cy: 72, path: 'M 82,65 L 98,65 Q 100,75 110,80 L 70,80 Q 80,75 82,65 Z' },
  { id: 'b_u_back', name: 'Upper Back/Trapezius', cx: 90, cy: 95, path: 'M 80,80 Q 90,85 100,80 L 105,110 Q 90,115 75,110 Z' },
  { id: 'b_l_blade', name: 'Left Shoulder Blade', cx: 65, cy: 110, path: 'M 70,80 Q 60,100 60,140 Q 75,135 75,110 L 80,80 Z' },
  { id: 'b_r_blade', name: 'Right Shoulder Blade', cx: 115, cy: 110, path: 'M 110,80 Q 120,100 120,140 Q 105,135 105,110 L 100,80 Z' },
  { id: 'b_m_back', name: 'Mid Back', cx: 90, cy: 165, path: 'M 60,140 Q 90,145 120,140 L 115,185 Q 90,190 65,185 Z' },
  { id: 'b_l_back', name: 'Lower Back', cx: 90, cy: 205, path: 'M 65,185 Q 90,190 115,185 L 120,230 Q 90,235 60,230 Z' },
  { id: 'b_l_shoulder', name: 'Left Shoulder (back)', cx: 55, cy: 95, path: 'M 70,80 Q 55,80 45,95 Q 40,110 60,115 L 75,110 Q 70,95 70,80 Z' },
  { id: 'b_r_shoulder', name: 'Right Shoulder (back)', cx: 125, cy: 95, path: 'M 110,80 Q 125,80 135,95 Q 140,110 120,115 L 105,110 Q 110,95 110,80 Z' },
  { id: 'b_l_u_arm', name: 'Left Upper Arm (back)', cx: 45, cy: 140, path: 'M 45,95 Q 30,130 35,170 L 55,170 Q 60,130 60,115 L 45,95 Z' },
  { id: 'b_r_u_arm', name: 'Right Upper Arm (back)', cx: 135, cy: 140, path: 'M 135,95 Q 150,130 145,170 L 125,170 Q 120,130 120,115 L 135,95 Z' },
  { id: 'b_l_elbow', name: 'Left Elbow', cx: 45, cy: 170, path: 'M 35,170 Q 45,175 55,170 L 55,180 Q 45,175 35,180 Z' },
  { id: 'b_r_elbow', name: 'Right Elbow', cx: 135, cy: 170, path: 'M 145,170 Q 135,175 125,170 L 125,180 Q 135,175 145,180 Z' },
  { id: 'b_l_forearm', name: 'Left Forearm (back)', cx: 40, cy: 210, path: 'M 35,180 Q 25,210 30,240 L 50,240 Q 55,210 55,180 Z' },
  { id: 'b_r_forearm', name: 'Right Forearm (back)', cx: 140, cy: 210, path: 'M 145,180 Q 155,210 150,240 L 130,240 Q 125,210 125,180 Z' },
  { id: 'b_l_hand', name: 'Left Hand (back)', cx: 35, cy: 260, path: 'M 30,240 Q 25,260 30,275 Q 40,285 45,275 Q 50,260 50,240 Z' },
  { id: 'b_r_hand', name: 'Right Hand (back)', cx: 145, cy: 260, path: 'M 150,240 Q 155,260 150,275 Q 140,285 135,275 Q 130,260 130,240 Z' },
  { id: 'b_l_glute', name: 'Left Glute', cx: 70, cy: 245, path: 'M 60,230 Q 90,235 90,265 L 50,265 Q 45,245 60,230 Z' },
  { id: 'b_r_glute', name: 'Right Glute', cx: 110, cy: 245, path: 'M 90,265 Q 90,235 120,230 Q 135,245 130,265 Z' },
  { id: 'b_l_hamstring', name: 'Left Hamstring', cx: 65, cy: 300, path: 'M 50,265 Q 35,300 45,335 L 85,335 Q 95,300 90,265 Z' },
  { id: 'b_r_hamstring', name: 'Right Hamstring', cx: 115, cy: 300, path: 'M 130,265 Q 145,300 135,335 L 95,335 Q 85,300 90,265 Z' },
  { id: 'b_l_knee', name: 'Left Knee (back)', cx: 65, cy: 347, path: 'M 45,335 L 85,335 Q 87,347 82,360 L 48,360 Q 43,347 45,335 Z' },
  { id: 'b_r_knee', name: 'Right Knee (back)', cx: 115, cy: 347, path: 'M 135,335 L 95,335 Q 93,347 98,360 L 132,360 Q 137,347 135,335 Z' },
  { id: 'b_l_calf', name: 'Left Calf', cx: 65, cy: 382, path: 'M 48,360 L 82,360 Q 85,385 80,405 L 55,405 Q 50,385 48,360 Z' },
  { id: 'b_r_calf', name: 'Right Calf', cx: 115, cy: 382, path: 'M 132,360 L 98,360 Q 95,385 100,405 L 125,405 Q 130,385 132,360 Z' },
  { id: 'b_l_foot', name: 'Left Heel & Foot', cx: 65, cy: 412, path: 'M 55,405 L 80,405 Q 90,418 80,418 L 45,418 Q 40,415 55,405 Z' },
  { id: 'b_r_foot', name: 'Right Heel & Foot', cx: 115, cy: 412, path: 'M 125,405 L 100,405 Q 90,418 100,418 L 135,418 Q 140,415 125,405 Z' },
];

export function BodyMap({ mode, initialData = {}, onChange }: BodyMapProps) {
  const [painData, setPainData] = useState<Record<string, number>>(initialData);
  const [selectedRegion, setSelectedRegion] = useState<{ id: string, name: string, x: number, y: number } | null>(null);

  useEffect(() => {
    setPainData(initialData);
  }, [initialData]);

  const handleRegionClick = (e: React.MouseEvent<SVGPathElement>, id: string, name: string) => {
    if (mode === 'readonly') return;
    
    if (painData[id]) {
      const newData = { ...painData };
      delete newData[id];
      setPainData(newData);
      onChange?.(newData);
      return;
    }

    setSelectedRegion({ id, name, x: e.clientX, y: e.clientY });
  };

  const handleScoreSelect = (score: number) => {
    if (!selectedRegion) return;
    const newData = { ...painData, [selectedRegion.id]: score };
    setPainData(newData);
    onChange?.(newData);
    setSelectedRegion(null);
  };

  return (
    <div className="flex flex-col md:flex-row justify-center items-center gap-12 w-full max-w-2xl mx-auto">
      {/* Front View */}
      <div className="text-center relative">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Front</p>
        <svg viewBox="0 0 180 420" width="180" height="420" className="drop-shadow-sm mx-auto">
          {FRONT_REGIONS.map(region => {
            const score = painData[region.id];
            const isSelected = !!score;
            return (
              <g key={region.id} className="group">
                <path
                  d={region.path}
                  data-label={region.name}
                  fill={isSelected ? getScoreColor(score) : '#E8E4DC'}
                  stroke="#C4BFB8"
                  strokeWidth="1"
                  className={`transition-colors duration-200 ${mode === 'interactive' ? 'cursor-pointer hover:fill-[#D1CCC2]' : ''} ${isSelected ? '!hover:opacity-80' : ''}`}
                  onClick={(e) => handleRegionClick(e, region.id, region.name)}
                />
                {isSelected && (
                  <text 
                    x={region.cx} 
                    y={region.cy} 
                    textAnchor="middle" 
                    dominantBaseline="central"
                    fill="#FFF"
                    fontSize="12"
                    fontWeight="bold"
                    pointerEvents="none"
                  >
                    {score}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Back View */}
      <div className="text-center relative">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Back</p>
        <svg viewBox="0 0 180 420" width="180" height="420" className="drop-shadow-sm mx-auto">
          {BACK_REGIONS.map(region => {
            const score = painData[region.id];
            const isSelected = !!score;
            return (
              <g key={region.id} className="group">
                <path
                  d={region.path}
                  data-label={region.name}
                  fill={isSelected ? getScoreColor(score) : '#E8E4DC'}
                  stroke="#C4BFB8"
                  strokeWidth="1"
                  className={`transition-colors duration-200 ${mode === 'interactive' ? 'cursor-pointer hover:fill-[#D1CCC2]' : ''} ${isSelected ? '!hover:opacity-80' : ''}`}
                  onClick={(e) => handleRegionClick(e, region.id, region.name)}
                />
                {isSelected && (
                  <text 
                    x={region.cx} 
                    y={region.cy} 
                    textAnchor="middle" 
                    dominantBaseline="central"
                    fill="#FFF"
                    fontSize="12"
                    fontWeight="bold"
                    pointerEvents="none"
                  >
                    {score}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Interactive Popover */}
      {selectedRegion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-lg text-gray-900">{selectedRegion.name}</h3>
                <p className="text-sm text-gray-500">Rate your pain level</p>
              </div>
              <button onClick={() => setSelectedRegion(null)} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2 mb-4">
              {[1,2,3,4,5,6,7,8,9,10].map(num => (
                <button
                  key={num}
                  onClick={() => handleScoreSelect(num)}
                  className="aspect-square flex flex-col items-center justify-center rounded-xl border-2 border-gray-100 hover:border-primary hover:bg-primary/5 transition-all text-sm font-bold text-gray-700"
                  style={{
                    backgroundColor: num <= 3 ? '#D9B29C10' : num <= 6 ? '#F5A62310' : '#C0392B10',
                    borderColor: num <= 3 ? '#D9B29C40' : num <= 6 ? '#F5A62340' : '#C0392B40',
                    color: num <= 3 ? '#B88B71' : num <= 6 ? '#D98900' : '#A02015'
                  }}
                >
                  {num}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 px-2 font-medium">
              <span>Mild</span>
              <span>Severe</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
