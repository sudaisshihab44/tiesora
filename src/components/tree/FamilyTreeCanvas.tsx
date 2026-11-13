import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FamilyPerson, Relationship, TreeViewMode } from '../../types';
import { computeTreeLayout } from '../../utils/treeLayout';
import { PersonCard } from './PersonCard';
import { TreeControls } from './TreeControls';
import { ImportFamilyTreeModal } from './ImportFamilyTreeModal';
import { Users, Calendar, MapPin, Heart, Plus, Edit } from 'lucide-react';

interface FamilyTreeCanvasProps {
  people: FamilyPerson[];
  relationships: Relationship[];
  selectedPerson?: FamilyPerson;
  onSelectPerson: (person: FamilyPerson) => void;
  onAddRelative?: (targetPerson?: FamilyPerson) => void;
  onExploreRelationship: (person: FamilyPerson) => void;
  onEditPerson?: (person: FamilyPerson) => void;
  familyId: string;
  familyName: string;
  userIsAdmin?: boolean;
  onRefresh: () => void;
}

export const FamilyTreeCanvas: React.FC<FamilyTreeCanvasProps> = ({
  people,
  relationships,
  selectedPerson,
  onSelectPerson,
  onAddRelative,
  onExploreRelationship,
  onEditPerson,
  familyId,
  familyName,
  userIsAdmin = false,
  onRefresh,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 120, y: 80 });
  const [zoom, setZoom] = useState<number>(0.85);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // View mode & search
  const [viewMode, setViewMode] = useState<TreeViewMode>('tree');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  // Large trees are much faster in the directory list. Switch once when the
  // data arrives, while still letting the user open the canvas manually.
  const LARGE_FAMILY_THRESHOLD = 400;
  const isLargeFamily = people.length > LARGE_FAMILY_THRESHOLD;
  const autoSwitchedToLargeView = useRef(false);
  useEffect(() => {
    if (isLargeFamily && !autoSwitchedToLargeView.current) {
      autoSwitchedToLargeView.current = true;
      setViewMode('list');
    }
  }, [isLargeFamily]);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);

  // Filtered people set based on viewMode
  const activePeople = useMemo(() => {
    if (viewMode === 'tree' || viewMode === 'list' || !selectedPerson) {
      return people;
    }

    if (viewMode === 'ancestors') {
      // Find all ancestors of selectedPerson
      const ancestorIds = new Set<string>([selectedPerson.id]);
      const queue = [selectedPerson.id];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        relationships.forEach(r => {
          if (r.target_person_id === curr && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationship_type)) {
            if (!ancestorIds.has(r.source_person_id)) {
              ancestorIds.add(r.source_person_id);
              queue.push(r.source_person_id);
            }
          }
        });
      }
      return people.filter(p => ancestorIds.has(p.id));
    }

    if (viewMode === 'descendants') {
      // Find all descendants of selectedPerson
      const descendantIds = new Set<string>([selectedPerson.id]);
      const queue = [selectedPerson.id];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        relationships.forEach(r => {
          if (r.source_person_id === curr && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationship_type)) {
            if (!descendantIds.has(r.target_person_id)) {
              descendantIds.add(r.target_person_id);
              queue.push(r.target_person_id);
            }
          }
        });
      }
      return people.filter(p => descendantIds.has(p.id));
    }

    return people;
  }, [people, relationships, viewMode, selectedPerson]);

  // Compute Layout
  const layout = useMemo(() => {
    return computeTreeLayout(activePeople, relationships, collapsedIds);
  }, [activePeople, relationships, collapsedIds]);

  // Ancestor / descendant highlight sets
  const { ancestorIds, descendantIds } = useMemo(() => {
    if (!selectedPerson) return { ancestorIds: new Set<string>(), descendantIds: new Set<string>() };

    const aSet = new Set<string>();
    const aQueue = [selectedPerson.id];
    while (aQueue.length > 0) {
      const curr = aQueue.shift()!;
      relationships.forEach(r => {
        if (r.target_person_id === curr && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationship_type)) {
          if (!aSet.has(r.source_person_id)) {
            aSet.add(r.source_person_id);
            aQueue.push(r.source_person_id);
          }
        }
      });
    }

    const dSet = new Set<string>();
    const dQueue = [selectedPerson.id];
    while (dQueue.length > 0) {
      const curr = dQueue.shift()!;
      relationships.forEach(r => {
        if (r.source_person_id === curr && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationship_type)) {
          if (!dSet.has(r.target_person_id)) {
            dSet.add(r.target_person_id);
            dQueue.push(r.target_person_id);
          }
        }
      });
    }

    return { ancestorIds: aSet, descendantIds: dSet };
  }, [selectedPerson, relationships]);

  // Center on Person
  const centerOnPerson = useCallback((personId: string) => {
    const node = layout.nodes.find(n => n.person.id === personId);
    if (!node || !containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    const targetX = containerWidth / 2 - (node.x + 120) * zoom;
    const targetY = containerHeight / 2 - (node.y + 55) * zoom;

    setPan({ x: targetX, y: targetY });
  }, [layout.nodes, zoom]);

  // Center on select if person changes externally
  useEffect(() => {
    if (selectedPerson) {
      centerOnPerson(selectedPerson.id);
    }
  }, [selectedPerson?.id]);

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

  // Initial fit
  useEffect(() => {
    fitToScreen();
  }, []);

  // Zoom handlers
  const handleZoomIn = () => setZoom(z => Math.min(z + 0.15, 2.0));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.15, 0.35));
  const handleResetZoom = () => {
    setZoom(1.0);
    fitToScreen();
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom(z => Math.min(Math.max(z * zoomFactor, 0.35), 2.0));
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag with left mouse button on background
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile panning & pinch-to-zoom
  const touchStartRef = useRef<{ x: number; y: number; dist?: number }>({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX - pan.x, y: t.clientY - pan.y };
      setIsDragging(true);
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartRef.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - pan.x,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - pan.y,
        dist,
      };
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      setPan({
        x: t.clientX - touchStartRef.current.x,
        y: t.clientY - touchStartRef.current.y,
      });
    } else if (e.touches.length === 2 && touchStartRef.current.dist) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchStartRef.current.dist;
      setZoom(z => Math.min(Math.max(z * (ratio > 1 ? 1.02 : 0.98), 0.35), 2.0));
      touchStartRef.current.dist = dist;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Toggle Collapse Branch
  const handleToggleCollapse = (personId: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  };

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] bg-stone-50 overflow-hidden select-none">
      {/* Top Floating Controls */}
      <TreeControls
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onFitToScreen={fitToScreen}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        people={people}
        onSelectPerson={(p) => {
          onSelectPerson(p);
          centerOnPerson(p.id);
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddNewMember={onAddRelative ? () => onAddRelative() : undefined}
        onImportFamilyTree={userIsAdmin ? () => setShowImportModal(true) : undefined}
        selectedPerson={selectedPerson}
      />

      {/* Import Family Tree Modal */}
      {showImportModal && (
        <ImportFamilyTreeModal
          familyId={familyId}
          familyName={familyName}
          onClose={() => setShowImportModal(false)}
          onImportComplete={() => {
            console.log('PDF import completed successfully');
            setShowImportModal(false);
            onRefresh();
          }}
        />
      )}

      {/* Directory List View (when in list mode) */}
      {viewMode === 'list' ? (
        <div className="absolute inset-0 top-14 p-3 sm:p-5 overflow-y-auto bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900 tracking-tight">Family Directory</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {people.length} members across {layout.generationLevels.length} generations.
                </p>
                {isLargeFamily && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2 inline-block">
                    Large family: list view is the fastest way to browse. Use the
                    Tree button when you need the canvas.
                  </p>
                )}
              </div>
              {onAddRelative && (
              <button
                onClick={() => onAddRelative()}
                className="px-3 py-1.5 bg-emerald-800 text-white rounded-lg text-xs font-medium hover:bg-emerald-900 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Member
              </button>
              )}
            </div>

            {/* Responsive table: full table on md+, card list on mobile */}
            <div className="hidden md:block border border-stone-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold">
                    <th className="py-2.5 px-3">Member</th>
                    <th className="py-2.5 px-3">Generation</th>
                    <th className="py-2.5 px-3">Lifespan</th>
                    <th className="py-2.5 px-3 hidden lg:table-cell">Birthplace</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {people.map(person => (
                    <tr
                      key={person.id}
                      onClick={() => onSelectPerson(person)}
                      className="hover:bg-emerald-50/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center font-semibold text-xs text-stone-700 shrink-0">
                            {person.display_name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-stone-900 truncate">{person.display_name}</p>
                            <p className="text-[10px] text-stone-400 truncate">{person.full_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 tabular-nums text-stone-600 whitespace-nowrap">
                        Gen {person.generation_level}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums text-stone-600 whitespace-nowrap">
                        {person.birth_date ? person.birth_date.substring(0, 4) : '—'}
                        {person.death_date ? `–${person.death_date.substring(0, 4)}` : ''}
                      </td>
                      <td className="py-2.5 px-3 text-stone-500 hidden lg:table-cell">
                        {person.birth_place || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] font-medium ${person.living_status === 'living' ? 'text-emerald-700' : 'text-stone-400'}`}>
                          {person.living_status === 'living' ? 'Living' : 'Deceased'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => onExploreRelationship(person)} className="px-2 py-1 text-emerald-800 hover:bg-emerald-50 rounded text-xs transition-colors">Path</button>
                          {onAddRelative && <button onClick={() => onAddRelative(person)} className="px-2 py-1 text-stone-600 hover:bg-stone-100 rounded text-xs transition-colors">+Rel</button>}
                          {onEditPerson && <button onClick={() => onEditPerson(person)} className="px-2 py-1 text-stone-600 hover:bg-stone-100 rounded text-xs transition-colors">Edit</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-2">
              {people.map(person => (
                <div
                  key={person.id}
                  onClick={() => onSelectPerson(person)}
                  className="bg-white border border-stone-200 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:border-emerald-700/50 transition-all"
                >
                  <div className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center font-semibold text-xs text-stone-700 shrink-0">
                    {person.display_name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-900 text-xs truncate">{person.display_name}</p>
                    <p className="text-[10px] text-stone-400">Gen {person.generation_level} · {person.living_status === 'living' ? 'Living' : 'Deceased'}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {onEditPerson && (
                    <button onClick={() => onEditPerson(person)} className="p-1.5 text-stone-400 hover:text-emerald-800 rounded-lg hover:bg-emerald-50 transition-colors">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    )}
                    {onAddRelative && (
                    <button onClick={() => onAddRelative(person)} className="p-1.5 text-stone-400 hover:text-emerald-800 rounded-lg hover:bg-emerald-50 transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Infinite Interactive Canvas View */
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`w-full h-full cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
            className="relative"
          >
            {/* Generation Level Bands */}
            {layout.generationLevels.map(gl => (
              <div
                key={gl.level}
                style={{ top: `${gl.y}px`, left: '40px', width: `${layout.bounds.width + 400}px` }}
                className="absolute flex items-center gap-4 pointer-events-none select-none z-0"
              >
                <span className="text-[11px] font-semibold tracking-wider uppercase text-emerald-900/40 whitespace-nowrap">
                  {gl.label}
                </span>
                <div className="flex-1 h-px bg-stone-200/60 border-t border-dashed border-stone-300" />
              </div>
            ))}

            {/* SVG Connecting Edges Layer */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${layout.bounds.maxX + 400}px`,
                height: `${layout.bounds.maxY + 400}px`,
                overflow: 'visible',
                pointerEvents: 'none',
              }}
            >
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="5"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#1b4332" />
                </marker>
              </defs>

              {layout.edges.map(edge => {
                const isSpouse = ['spouse', 'partner'].includes(edge.type);

                if (isSpouse) {
                  // Direct horizontal connection between spouses
                  const midX = (edge.sourceX + edge.targetX) / 2;
                  const midY = edge.sourceY;

                  return (
                    <g key={edge.id}>
                      <line
                        x1={edge.sourceX}
                        y1={edge.sourceY}
                        x2={edge.targetX}
                        y2={edge.targetY}
                        stroke="#B45309"
                        strokeWidth="1.5"
                        strokeDasharray="none"
                        opacity={0.8}
                      />
                      {/* Spouse connection badge */}
                      <circle
                        cx={midX}
                        cy={midY}
                        r="8"
                        fill="#FEF3C7"
                        stroke="#D97706"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx={midX}
                        cy={midY}
                        r="3"
                        fill="#D97706"
                      />
                    </g>
                  );
                }

                // Parent to Child Orthogonal / Bezier Curve
                const midY = (edge.sourceY + edge.targetY) / 2;
                const pathD = `M ${edge.sourceX} ${edge.sourceY} C ${edge.sourceX} ${midY}, ${edge.targetX} ${midY}, ${edge.targetX} ${edge.targetY}`;
                const isAdoptive = edge.type === 'adoptive_parent';
                const isStep = edge.type === 'step_parent';

                return (
                  <g key={edge.id}>
                    <path
                      d={pathD}
                      fill="none"
                      stroke={isAdoptive || isStep ? '#059669' : '#143828'}
                      strokeWidth={isAdoptive || isStep ? '1.5' : '2'}
                      strokeDasharray={isAdoptive || isStep ? '5 4' : 'none'}
                      opacity={0.7}
                    />
                    {edge.label && (
                      <text
                        x={(edge.sourceX + edge.targetX) / 2}
                        y={midY - 6}
                        textAnchor="middle"
                        fill="#047857"
                        fontSize="10"
                        fontFamily="sans-serif"
                        fontWeight="600"
                        className="select-none"
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Person Cards Layer */}
            {layout.nodes.map(node => {
              const isSelected = selectedPerson?.id === node.person.id;
              const isAncestor = ancestorIds.has(node.person.id);
              const isDescendant = descendantIds.has(node.person.id);

              return (
                <div
                  key={node.person.id}
                  style={{
                    position: 'absolute',
                    transform: `translate(${node.x}px, ${node.y}px)`,
                  }}
                  className="z-10"
                >
                  <PersonCard
                    person={node.person}
                    isSelected={isSelected}
                    isHighlighted={isAncestor || isDescendant}
                    hasChildren={node.children.length > 0}
                    isCollapsed={node.collapsed}
                    onSelect={onSelectPerson}
                    onAddRelative={onAddRelative}
                    onExploreRelationship={onExploreRelationship}
                    onToggleCollapse={handleToggleCollapse}
                    onEdit={onEditPerson}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
