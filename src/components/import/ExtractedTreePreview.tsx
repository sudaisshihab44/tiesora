import React, { useMemo, useState, useRef, useCallback } from 'react';
import type { 
  ExtractedFamilyMember, 
  ExtractedRelationship,
  FamilyPerson,
  Relationship 
} from '../../types';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Users,
  GitFork,
} from 'lucide-react';
import { computeTreeLayout } from '../../utils/treeLayout';

interface ExtractedTreePreviewProps {
  members: ExtractedFamilyMember[];
  relationships: ExtractedRelationship[];
  onSelectPerson?: (member: ExtractedFamilyMember) => void;
  selectedPersonId?: string;
  highlightUncertain?: boolean;
}

/**
 * Interactive preview of extracted family tree data
 * Adapts the existing FamilyTreeCanvas design for extracted data visualization
 */
export const ExtractedTreePreview: React.FC<ExtractedTreePreviewProps> = ({
  members,
  relationships,
  onSelectPerson,
  selectedPersonId,
  highlightUncertain = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Pan & Zoom state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 120, y: 80 });
  const [zoom, setZoom] = useState<number>(0.75);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Convert extracted members to FamilyPerson format for tree layout
  const adaptedPeople: FamilyPerson[] = useMemo(() => {
    return members.map(m => ({
      id: m.id,
      family_id: m.family_id,
      full_name: m.full_name || 'Unknown',
      display_name: m.display_name || m.full_name || 'Unknown',
      gender: m.gender || 'unspecified',
      birth_date: m.birth_date || undefined,
      birth_place: m.birth_place || undefined,
      death_date: m.death_date || undefined,
      death_place: m.death_place || undefined,
      date_precision: 'unknown',
      living_status: m.living_status || 'unknown',
      biography: m.biography || undefined,
      avatar_path: undefined,
      generation_level: m.generation_level || 1,
      branch: m.branch || undefined,
      created_by: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }, [members]);

  // Convert extracted relationships to Relationship format
  const adaptedRelationships: Relationship[] = useMemo(() => {
    const rels: Relationship[] = [];

    relationships.forEach(r => {
      // Find source and target persons by name matching
      const sourcePerson = members.find(m => 
        m.id === r.source_extracted_id || 
        m.full_name.toLowerCase() === (r.source_extracted_id || '').toLowerCase()
      );
      const targetPerson = members.find(m => 
        m.id === r.target_extracted_id ||
        m.full_name.toLowerCase() === (r.target_extracted_id || '').toLowerCase()
      );

      if (sourcePerson && targetPerson) {
        rels.push({
          id: r.id,
          family_id: r.family_id,
          source_person_id: sourcePerson.id,
          target_person_id: targetPerson.id,
          relationship_type: r.relationship_type as any,
          relationship_status: r.verification_status === 'verified' ? 'verified' : 'unverified',
          valid_from: r.marriage_date || undefined,
          valid_to: r.divorce_date || undefined,
          notes: r.relationship_notes || undefined,
          created_by: '',
          verified_at: r.verification_status === 'verified' ? new Date().toISOString() : undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    });

    return rels;
  }, [members, relationships]);

  // Compute tree layout
  const layout = useMemo(() => {
    return computeTreeLayout(adaptedPeople, adaptedRelationships);
  }, [adaptedPeople, adaptedRelationships]);

  // Zoom handlers
  const handleZoomIn = () => setZoom(z => Math.min(z + 0.15, 2.0));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.15, 0.35));
  const handleResetZoom = () => setZoom(0.75);

  // Fit to screen
  const fitToScreen = useCallback(() => {
    if (!containerRef.current || layout.nodes.length === 0) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const b = layout.bounds;
    const padding = 80;
    const scaleX = (width - padding * 2) / (b.width || 800);
    const scaleY = (height - padding * 2) / (b.height || 600);
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.1);

    const centerX = width / 2 - ((b.minX + b.maxX) / 2) * newZoom;
    const centerY = height / 2 - ((b.minY + b.maxY) / 2) * newZoom;

    setZoom(newZoom);
    setPan({ x: centerX, y: centerY });
  }, [layout.bounds, layout.nodes.length]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Get verification status icon and color
  const getVerificationBadge = (member: ExtractedFamilyMember) => {
    switch (member.verification_status) {
      case 'verified':
        return { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', label: 'Verified' };
      case 'uncertain':
        return { icon: HelpCircle, color: 'text-orange-600', bg: 'bg-orange-50', label: 'Uncertain' };
      case 'needs_review':
        return { icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Review' };
      case 'duplicate':
        return { icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Duplicate' };
      case 'rejected':
        return { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Rejected' };
      default:
        return { icon: HelpCircle, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Unknown' };
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-gray-500';
    if (confidence >= 0.85) return 'text-green-600';
    if (confidence >= 0.60) return 'text-blue-600';
    return 'text-orange-600';
  };

  // Statistics
  const stats = useMemo(() => {
    const verified = members.filter(m => m.verification_status === 'verified').length;
    const uncertain = members.filter(m => m.verification_status === 'uncertain').length;
    const needsReview = members.filter(m => m.verification_status === 'needs_review').length;
    const avgConfidence = members.length > 0
      ? members.reduce((sum, m) => sum + (m.confidence_score || 0), 0) / members.length
      : 0;

    return { verified, uncertain, needsReview, avgConfidence };
  }, [members]);

  if (members.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
        <div className="text-center">
          <GitFork size={48} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 font-medium">No family members extracted yet</p>
          <p className="text-sm text-gray-500 mt-1">Upload and analyze a PDF to see the preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-stone-50 rounded-xl overflow-hidden">
      {/* Stats Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-[#285C43]" />
              <span className="font-semibold text-gray-900">{members.length} Members</span>
            </div>
            <div className="flex items-center gap-2">
              <GitFork size={18} className="text-[#285C43]" />
              <span className="font-semibold text-gray-900">{relationships.length} Relationships</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 rounded-md">
              <CheckCircle2 size={14} className="text-green-600" />
              <span className="text-green-700 font-medium">{stats.verified} Verified</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-md">
              <AlertCircle size={14} className="text-blue-600" />
              <span className="text-blue-700 font-medium">{stats.needsReview} Review</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-50 rounded-md">
              <HelpCircle size={14} className="text-orange-600" />
              <span className="text-orange-700 font-medium">{stats.uncertain} Uncertain</span>
            </div>
            <div className="px-2 py-1 bg-gray-100 rounded-md">
              <span className="text-gray-700 font-medium">
                Avg: {(stats.avgConfidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="absolute top-20 right-4 z-20 flex flex-col gap-1 bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-stone-200 shadow-sm">
        <button 
          onClick={handleZoomIn} 
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={18} className="text-stone-700" />
        </button>
        <span className="text-xs font-mono font-medium px-2 py-1 text-center text-stone-600">
          {Math.round(zoom * 100)}%
        </span>
        <button 
          onClick={handleZoomOut} 
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={18} className="text-stone-700" />
        </button>
        <div className="w-full h-px bg-stone-200 my-0.5" />
        <button 
          onClick={fitToScreen} 
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          title="Fit to Screen"
        >
          <Maximize2 size={18} className="text-stone-700" />
        </button>
        <button 
          onClick={handleResetZoom} 
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          title="Reset Zoom"
        >
          <RotateCcw size={18} className="text-stone-700" />
        </button>
      </div>

      {/* Tree Canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0 top-16 cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          width="100%"
          height="100%"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Render relationship lines */}
          {layout.edges.map((edge, idx) => {
            const isSpouse = ['spouse', 'partner'].includes(edge.type);
            const isAdoptive = edge.type === 'adoptive_parent';
            
            // Generate path based on edge type
            let pathD: string;
            if (isSpouse) {
              // Straight horizontal line for spouses
              pathD = `M ${edge.sourceX} ${edge.sourceY} L ${edge.targetX} ${edge.targetY}`;
            } else {
              // Parent-child: vertical then horizontal
              const midY = (edge.sourceY + edge.targetY) / 2;
              pathD = `M ${edge.sourceX} ${edge.sourceY} L ${edge.sourceX} ${midY} L ${edge.targetX} ${midY} L ${edge.targetX} ${edge.targetY}`;
            }
            
            return (
              <g key={`edge-${idx}`}>
                <path
                  d={pathD}
                  stroke="#94A3B8"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray={isAdoptive ? '5,5' : undefined}
                />
              </g>
            );
          })}

          {/* Render person cards */}
          {layout.nodes.map((node) => {
            const member = members.find(m => m.id === node.person.id);
            if (!member) return null;

            const badge = getVerificationBadge(member);
            const BadgeIcon = badge.icon;
            const isSelected = selectedPersonId === member.id;
            const isUncertain = member.verification_status === 'uncertain' || 
                               (member.confidence_score || 0) < 0.60;

            return (
              <g
                key={node.person.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => onSelectPerson?.(member)}
                className="cursor-pointer"
              >
                {/* Card background */}
                <rect
                  x="-90"
                  y="-45"
                  width="180"
                  height="90"
                  rx="8"
                  fill="white"
                  stroke={isSelected ? '#285C43' : highlightUncertain && isUncertain ? '#F59E0B' : '#E5E7EB'}
                  strokeWidth={isSelected ? 3 : highlightUncertain && isUncertain ? 2 : 1.5}
                  className="transition-all"
                />

                {/* Verification badge */}
                <circle
                  cx="75"
                  cy="-35"
                  r="12"
                  className={badge.bg}
                />
                <foreignObject x="63" y="-47" width="24" height="24">
                  <div className="flex items-center justify-center w-full h-full">
                    <BadgeIcon size={14} className={badge.color} />
                  </div>
                </foreignObject>

                {/* Name */}
                <text
                  x="0"
                  y="-15"
                  textAnchor="middle"
                  className="fill-gray-900 font-semibold text-sm"
                  style={{ fontSize: '13px' }}
                >
                  {member.display_name || member.full_name}
                </text>

                {/* Generation label */}
                {member.generation_label && (
                  <text
                    x="0"
                    y="0"
                    textAnchor="middle"
                    className="fill-gray-500 text-xs"
                    style={{ fontSize: '11px' }}
                  >
                    Gen {member.generation_label}
                  </text>
                )}

                {/* Birth/Death years */}
                {(member.birth_year || member.death_year) && (
                  <text
                    x="0"
                    y="15"
                    textAnchor="middle"
                    className="fill-gray-600 text-xs"
                    style={{ fontSize: '10px' }}
                  >
                    {member.birth_year || '?'} — {member.death_year || member.living_status === 'living' ? 'Living' : '?'}
                  </text>
                )}

                {/* Confidence score */}
                {member.confidence_score !== undefined && (
                  <text
                    x="0"
                    y="30"
                    textAnchor="middle"
                    className={`text-xs font-medium ${getConfidenceColor(member.confidence_score)}`}
                    style={{ fontSize: '10px' }}
                  >
                    {(member.confidence_score * 100).toFixed(0)}% confident
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-md rounded-lg border border-gray-200 shadow-sm p-3">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Verification Status</h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-600" />
            <span className="text-xs text-gray-600">Verified</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-blue-600" />
            <span className="text-xs text-gray-600">Needs Review</span>
          </div>
          <div className="flex items-center gap-2">
            <HelpCircle size={14} className="text-orange-600" />
            <span className="text-xs text-gray-600">Uncertain</span>
          </div>
        </div>
      </div>
    </div>
  );
};
