import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FamilyPerson, Relationship, TreeViewMode } from '../../types';
import { computeTreeLayout } from '../../utils/treeLayout';
import {
  buildGenerationOptions,
  computeEffectiveGenerations,
  pickRootPerson,
} from '../../utils/generations';
import { computeFocusTree } from '../../utils/focusTree';
import { PersonCard } from './PersonCard';
import { TreeControls } from './TreeControls';
import { GenerationBar } from './GenerationBar';
import { FocusBar } from './FocusBar';
import { MemberAvatar } from '../common/MemberAvatar';
import { ImportFamilyTreeModal } from './ImportFamilyTreeModal';
import { Users, Calendar, MapPin, Heart, Plus, Edit } from 'lucide-react';

const PARENT_RELATIONSHIP_TYPES = new Set([
  'parent',
  'adoptive_parent',
  'step_parent',
]);

const SPOUSE_RELATIONSHIP_TYPES = new Set(['spouse', 'partner']);

interface FamilyTreeCanvasProps {
  people: FamilyPerson[];
  relationships: Relationship[];
  selectedPerson?: FamilyPerson;
  onSelectPerson: (person: FamilyPerson) => void;
  onFocusPerson?: (person: FamilyPerson) => void;
  onAddRelative?: (targetPerson?: FamilyPerson) => void;
  onExploreRelationship: (person: FamilyPerson) => void;
  onEditPerson?: (person: FamilyPerson) => void;
  familyId: string;
  familyName: string;
  userIsAdmin?: boolean;
  pathHighlightIds?: string[];
  onRefresh: () => void;
}

export const FamilyTreeCanvas: React.FC<FamilyTreeCanvasProps> = ({
  people,
  relationships,
  selectedPerson,
  onSelectPerson,
  onFocusPerson,
  onAddRelative,
  onExploreRelationship,
  onEditPerson,
  familyId,
  familyName,
  userIsAdmin = false,
  pathHighlightIds = [],
  onRefresh,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 120, y: 80 });
  const [zoom, setZoom] = useState<number>(0.85);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // View mode & search. Focus is the default for real-sized families; small
  // families keep the broader tree view.
  const FOCUS_FIRST_THRESHOLD = 50;
  const [viewMode, setViewMode] = useState<TreeViewMode>(
    people.length > FOCUS_FIRST_THRESHOLD ? 'focus' : 'tree',
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [focusedGeneration, setFocusedGeneration] = useState<number | 'all'>('all');
  const [focusAncestorDepth, setFocusAncestorDepth] = useState(1);
  const [focusDescendantDepth, setFocusDescendantDepth] = useState(1);

  // Large trees open on a single generation in the full tree view. The user
  // can return to the full tree from the generation selector.
  const LARGE_FAMILY_THRESHOLD = 250;
  const isLargeFamily = people.length > LARGE_FAMILY_THRESHOLD;
  const autoFocusedGeneration = useRef(false);

  const generationLevels = useMemo(
    () => computeEffectiveGenerations(people, relationships),
    [people, relationships],
  );

  const layoutPeople = useMemo(
    () =>
      people.map((person) => ({
        ...person,
        generation_level:
          generationLevels.get(person.id) ?? person.generation_level ?? 1,
      })),
    [people, generationLevels],
  );

  const selectedLayoutPerson = selectedPerson
    ? layoutPeople.find((person) => person.id === selectedPerson.id)
    : undefined;

  const rootPerson = useMemo(
    () =>
      pickRootPerson(
        layoutPeople,
        relationships,
        generationLevels,
        selectedLayoutPerson,
      ),
    [layoutPeople, relationships, generationLevels, selectedLayoutPerson],
  );

  const focusPerson = selectedLayoutPerson ?? rootPerson;

  const focusTree = useMemo(
    () =>
      computeFocusTree(
        layoutPeople,
        relationships,
        focusPerson?.id ?? '',
        focusAncestorDepth,
        focusDescendantDepth,
      ),
    [
      layoutPeople,
      relationships,
      focusPerson?.id,
      focusAncestorDepth,
      focusDescendantDepth,
    ],
  );

  useEffect(() => {
    setFocusAncestorDepth(1);
    setFocusDescendantDepth(1);
  }, [focusPerson?.id]);

  const rootLevel = rootPerson
    ? generationLevels.get(rootPerson.id) ?? rootPerson.generation_level ?? 1
    : 1;

  const generationOptions = useMemo(
    () => buildGenerationOptions(layoutPeople, generationLevels, rootLevel),
    [layoutPeople, generationLevels, rootLevel],
  );

  useEffect(() => {
    if (autoFocusedGeneration.current || people.length === 0) return;
    autoFocusedGeneration.current = true;
    if (isLargeFamily && rootLevel > 0) {
      setFocusedGeneration(rootLevel);
    }
  }, [people.length, isLargeFamily, rootLevel]);

  useEffect(() => {
    if (
      focusedGeneration !== 'all' &&
      !generationOptions.some((option) => option.level === focusedGeneration)
    ) {
      setFocusedGeneration('all');
    }
  }, [focusedGeneration, generationOptions]);

  // Hide descendants of collapsed branches from the canvas entirely.
  const hiddenByCollapse = useMemo(() => {
    const hidden = new Set<string>();
    if (collapsedIds.size === 0) return hidden;

    const childMap = new Map<string, string[]>();
    for (const relationship of relationships) {
      if (
        !['parent', 'adoptive_parent', 'step_parent'].includes(
          relationship.relationship_type,
        ) ||
        relationship.source_person_id === relationship.target_person_id
      ) {
        continue;
      }
      const children = childMap.get(relationship.source_person_id) || [];
      children.push(relationship.target_person_id);
      childMap.set(relationship.source_person_id, children);
    }

    const stack: string[] = [];
    for (const id of collapsedIds) {
      stack.push(...(childMap.get(id) || []));
    }
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (hidden.has(id)) continue;
      hidden.add(id);
      stack.push(...(childMap.get(id) || []));
    }

    // The active root and selected profile must always remain visible.
    if (selectedPerson) hidden.delete(selectedPerson.id);
    if (rootPerson) hidden.delete(rootPerson.id);
    return hidden;
  }, [collapsedIds, relationships, selectedPerson?.id, rootPerson?.id]);

  const generationFilteredPeople = useMemo(() => {
    if (focusedGeneration === 'all') return layoutPeople;

    const focusedIds = new Set(
      layoutPeople
        .filter(
          (person) =>
            (generationLevels.get(person.id) ?? person.generation_level) ===
            focusedGeneration,
        )
        .map((person) => person.id),
    );
    if (focusedIds.size === 0) return [];

    const includedIds = new Set(focusedIds);

    // Keep the selected generation connected to its direct family: parents,
    // children, and spouses. Only expand one hop from the focused generation.
    for (const relationship of relationships) {
      const sourceFocused = focusedIds.has(relationship.source_person_id);
      const targetFocused = focusedIds.has(relationship.target_person_id);
      if (!sourceFocused && !targetFocused) continue;

      if (PARENT_RELATIONSHIP_TYPES.has(relationship.relationship_type)) {
        if (sourceFocused) includedIds.add(relationship.target_person_id);
        if (targetFocused) includedIds.add(relationship.source_person_id);
      } else if (SPOUSE_RELATIONSHIP_TYPES.has(relationship.relationship_type)) {
        const sourceLevel =
          generationLevels.get(relationship.source_person_id) ?? 1;
        const targetLevel =
          generationLevels.get(relationship.target_person_id) ?? 1;
        if (Math.abs(sourceLevel - targetLevel) > 1) continue;
        if (sourceFocused) includedIds.add(relationship.target_person_id);
        if (targetFocused) includedIds.add(relationship.source_person_id);
      }
    }

    return layoutPeople.filter((person) => includedIds.has(person.id));
  }, [layoutPeople, generationLevels, focusedGeneration, relationships]);

  const treeVisiblePeople = useMemo(
    () => generationFilteredPeople.filter((person) => !hiddenByCollapse.has(person.id)),
    [generationFilteredPeople, hiddenByCollapse],
  );

  const visiblePeople = viewMode === 'focus' ? focusTree.people : treeVisiblePeople;

  const generationLabels = useMemo(
    () =>
      Object.fromEntries(
        generationOptions.map((option) => [
          option.level,
          `Generation ${option.level} · ${option.relativeLabel}`,
        ]),
      ) as Record<number, string>,
    [generationOptions],
  );

  const parentsWithChildren = useMemo(
    () =>
      new Set(
        relationships
          .filter(
            (relationship) =>
              ['parent', 'adoptive_parent', 'step_parent'].includes(
                relationship.relationship_type,
              ) &&
              relationship.source_person_id !== relationship.target_person_id,
          )
          .map((relationship) => relationship.source_person_id),
      ),
    [relationships],
  );

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);

  const activeCollapsedIds = useMemo(
    () => (viewMode === 'focus' ? new Set<string>() : collapsedIds),
    [viewMode, collapsedIds],
  );

  // Compute Layout
  const layout = useMemo(() => {
    return computeTreeLayout(visiblePeople, relationships, activeCollapsedIds, generationLabels);
  }, [visiblePeople, relationships, activeCollapsedIds, generationLabels]);

  const pathHighlightSet = useMemo(
    () => new Set(pathHighlightIds),
    [pathHighlightIds],
  );

  useEffect(() => {
    if (pathHighlightIds.length === 0) return;
    setViewMode('tree');
    const pathPeople = layoutPeople.filter((person) =>
      pathHighlightIds.includes(person.id),
    );
    const levels = [...new Set(
      pathPeople.map(
        (person) =>
          generationLevels.get(person.id) ?? person.generation_level ?? 1,
      ),
    )].sort((a, b) => a - b);
    const span = levels.length > 0 ? levels[levels.length - 1] - levels[0] : 0;
    if (span <= 2 && levels.length > 1) {
      setFocusedGeneration(levels[Math.floor((levels.length - 1) / 2)]);
    } else {
      setFocusedGeneration('all');
    }
    setCollapsedIds(new Set());
  }, [pathHighlightIds, layoutPeople, generationLevels]);

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

  const centerOnPersonRef = useRef(centerOnPerson);
  useEffect(() => {
    centerOnPersonRef.current = centerOnPerson;
  }, [centerOnPerson]);

  // Center on select if person changes externally while in the full tree.
  useEffect(() => {
    if (viewMode === 'tree' && selectedPerson) {
      centerOnPerson(selectedPerson.id);
    }
  }, [selectedPerson?.id, viewMode, centerOnPerson]);

  // Fit to screen
  const fitToScreen = useCallback((allowSmall = false) => {
    if (!containerRef.current || layout.nodes.length === 0) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const b = layout.bounds;
    const padding = 80;
    const scaleX = (width - padding * 2) / (b.width || 800);
    const scaleY = (height - padding * 2) / (b.height || 600);
    const minZoom =
      viewMode === 'focus'
        ? allowSmall
          ? 0.35
          : 0.55
        : focusedGeneration === 'all'
          ? 0.35
          : 0.6;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), minZoom), 1.1);

    const centerX = width / 2 - ((b.minX + b.maxX) / 2) * newZoom;
    const centerY = height / 2 - ((b.minY + b.maxY) / 2) * newZoom;

    setZoom(newZoom);
    setPan({ x: centerX, y: centerY });
  }, [layout.bounds, layout.nodes.length, focusedGeneration, viewMode]);

  const fitToScreenRef = useRef(fitToScreen);
  useEffect(() => {
    fitToScreenRef.current = fitToScreen;
  }, [fitToScreen]);

  // The full tree re-fits when its generation scope changes. Focus view has
  // its own centering effect so expanding a branch does not cause a sudden
  // zoom-out of the whole canvas.
  useEffect(() => {
    if (viewMode !== 'tree') return;
    const frame = requestAnimationFrame(() => fitToScreen());
    return () => cancelAnimationFrame(frame);
  }, [focusedGeneration, viewMode, treeVisiblePeople.length, layout.nodes.length, fitToScreen]);

  // Focus mode uses two different viewport behaviors:
  // - changing the focused person centers that person;
  // - expanding a generation fits the newly visible branch so cards do not
  //   disappear off-screen.
  const previousFocusViewRef = useRef<{
    viewMode: TreeViewMode;
    id?: string;
    ancestors: number;
    descendants: number;
  } | null>(null);

  useEffect(() => {
    const previous = previousFocusViewRef.current;
    const current = {
      viewMode,
      id: focusPerson?.id,
      ancestors: focusAncestorDepth,
      descendants: focusDescendantDepth,
    };
    previousFocusViewRef.current = current;
    if (viewMode !== 'focus' || !focusPerson) return;

    const focusChanged =
      !previous ||
      previous.viewMode !== 'focus' ||
      previous.id !== focusPerson.id;
    const depthChanged =
      Boolean(previous) &&
      previous?.viewMode === 'focus' &&
      (previous.ancestors !== focusAncestorDepth ||
        previous.descendants !== focusDescendantDepth);

    const frame = requestAnimationFrame(() => {
      if (focusChanged) {
        centerOnPersonRef.current(focusPerson.id);
      } else if (depthChanged) {
        fitToScreenRef.current();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [viewMode, focusPerson?.id, focusAncestorDepth, focusDescendantDepth]);

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

  const handleSelectPerson = (person: FamilyPerson) => {
    const level =
      generationLevels.get(person.id) ?? person.generation_level ?? 1;
    if (viewMode === 'tree' && focusedGeneration !== 'all' && level !== focusedGeneration) {
      setFocusedGeneration(level);
    }
    onSelectPerson(person);
  };

  const handleFocusPerson = (person: FamilyPerson) => {
    const level =
      generationLevels.get(person.id) ?? person.generation_level ?? 1;
    if (onFocusPerson) {
      onFocusPerson(person);
    } else {
      onSelectPerson(person);
    }
    if (viewMode === 'tree' && focusedGeneration !== 'all' && level !== focusedGeneration) {
      setFocusedGeneration(level);
    }
  };

  const handleViewModeChange = (mode: TreeViewMode) => {
    if (mode === 'focus' && viewMode !== 'focus') {
      setFocusAncestorDepth(1);
      setFocusDescendantDepth(1);
      setZoom(0.9);
      if (focusPerson) {
        setFocusedGeneration(
          generationLevels.get(focusPerson.id) ?? focusPerson.generation_level ?? 1,
        );
      }
    }
    if (mode === 'tree' && viewMode === 'focus' && focusPerson) {
      setFocusedGeneration(
        generationLevels.get(focusPerson.id) ?? focusPerson.generation_level ?? 1,
      );
      setCollapsedIds(new Set());
    }
    setViewMode(mode);
  };

  const handleExpandAncestors = () => {
    setFocusAncestorDepth((depth) =>
      Math.min(depth + 1, Math.max(1, focusTree.maxAncestorDepth)),
    );
  };

  const handleExpandDescendants = () => {
    setFocusDescendantDepth((depth) =>
      Math.min(depth + 1, Math.max(1, focusTree.maxDescendantDepth)),
    );
  };

  const handleCenterFocus = () => {
    if (focusPerson) centerOnPerson(focusPerson.id);
  };

  const handleFitFocus = () => {
    fitToScreen(true);
  };

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] bg-stone-50 overflow-hidden select-none flex flex-col">
      {viewMode === 'focus' && focusPerson ? (
        <FocusBar
          focusPerson={focusPerson}
          ancestorDepth={focusAncestorDepth}
          descendantDepth={focusDescendantDepth}
          maxAncestorDepth={focusTree.maxAncestorDepth}
          maxDescendantDepth={focusTree.maxDescendantDepth}
          nextAncestorCount={focusTree.nextAncestorCount}
          nextDescendantCount={focusTree.nextDescendantCount}
          parentCount={focusTree.parentCount}
          childCount={focusTree.childCount}
          spouseCount={focusTree.spouseCount}
          siblingCount={focusTree.siblingCount}
          visibleCount={focusTree.people.length}
          onExpandAncestors={handleExpandAncestors}
          onExpandDescendants={handleExpandDescendants}
          onCenterFocus={handleCenterFocus}
          onFitFocus={handleFitFocus}
          onFullTree={() => handleViewModeChange('tree')}
        />
      ) : (
        <GenerationBar
          options={generationOptions}
          focusedGeneration={focusedGeneration}
          onChange={setFocusedGeneration}
          rootPerson={rootPerson}
          visibleCount={visiblePeople.length}
          totalCount={people.length}
        />
      )}

      <div className="relative flex-1 min-h-0 overflow-hidden">
      {/* Top Floating Controls */}
      <TreeControls
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onFitToScreen={() => fitToScreen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        people={layoutPeople}
        onSelectPerson={handleFocusPerson}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onAddNewMember={onAddRelative ? () => onAddRelative() : undefined}
        onImportFamilyTree={userIsAdmin ? () => setShowImportModal(true) : undefined}
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
                  {focusedGeneration === 'all'
                    ? `${visiblePeople.length} members across ${generationOptions.length} generations.`
                    : `${visiblePeople.length} members in Generation ${focusedGeneration}.`}
                </p>
                {isLargeFamily && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2 inline-block">
                    Large family: select a generation above for the clearest view,
                    or use the list for fast searching.
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
                  {visiblePeople.map(person => (
                    <tr
                      key={person.id}
                      onClick={() => onSelectPerson(person)}
                      className="hover:bg-emerald-50/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <MemberAvatar person={person} className="w-7 h-7 text-xs" />
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
              {visiblePeople.map(person => (
                <div
                  key={person.id}
                  onClick={() => onSelectPerson(person)}
                  className="bg-white border border-stone-200 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:border-emerald-700/50 transition-all"
                >
                  <MemberAvatar person={person} className="w-9 h-9 text-xs" />
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
              const isSelected =
                viewMode === 'focus'
                  ? focusPerson?.id === node.person.id
                  : selectedPerson?.id === node.person.id;
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
                    isPathNode={pathHighlightSet.has(node.person.id)}
                    hasChildren={parentsWithChildren.has(node.person.id)}
                    isCollapsed={viewMode === 'focus' ? false : node.collapsed}
                    onSelect={handleSelectPerson}
                    onAddRelative={onAddRelative}
                    onExploreRelationship={onExploreRelationship}
                    onToggleCollapse={viewMode === 'focus' ? undefined : handleToggleCollapse}
                    onEdit={onEditPerson}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
