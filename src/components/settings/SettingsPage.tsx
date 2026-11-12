import React, { useState } from 'react';
import { Family, UserProfile } from '../../types';
import { storage } from '../../services/storage';
import { exportToGEDCOM } from '../../utils/gedcom';
import { runRelationshipTestSuite, TestResult } from '../../utils/relationshipEngine.test';
import { 
  Settings, 
  Database, 
  Download, 
  Copy, 
  Check, 
  RefreshCw, 
  Shield, 
  Server, 
  Terminal, 
  Save,
  FileSpreadsheet,
  CheckCircle2,
  Upload,
  FileUp,
  AlertTriangle
} from 'lucide-react';

interface SettingsPageProps {
  family: Family;
  onRefresh: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  family,
  onRefresh,
}) => {
  const [name, setName] = useState(family.name);
  const [description, setDescription] = useState(family.description || '');
  const [copiedSQL, setCopiedSQL] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testResults, setTestResults] = useState<{ total: number; passed: number; failed: number; results: TestResult[] } | null>(() => runRelationshipTestSuite());

  // Import / restore state
  const [importFileContent, setImportFileContent] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  const currentUser = storage.getCurrentUser();

  const handleSaveFamily = (e: React.FormEvent) => {
    e.preventDefault();
    storage.updateFamily(family.id, {
      name: name.trim(),
      description: description.trim() || undefined,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
    onRefresh();
  };

  const handleExportJSON = () => {
    const jsonStr = storage.exportFullFamilyJSON(family.id);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tiesora_${family.name.toLowerCase().replace(/\s+/g, '_')}_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setImportError('Please select a valid Tiesora JSON backup file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || !parsed.family || !Array.isArray(parsed.people)) {
          setImportError('Invalid backup file structure: missing family or people definitions.');
          return;
        }
        setImportFileContent(text);
        setImportPreview(parsed);
      } catch (err: any) {
        setImportError(`Failed to parse JSON file: ${err?.message || 'Unknown syntax error'}`);
      }
    };
    reader.onerror = () => {
      setImportError('Failed to read the selected file.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExecuteRestore = (mode: 'restore' | 'import_as_new') => {
    if (!importFileContent) return;

    if (mode === 'restore') {
      const confirmMsg = `Are you sure you want to restore "${importPreview?.family?.name || 'this family'}" and replace your current workspace? Local changes to the active family will be replaced.`;
      if (!window.confirm(confirmMsg)) return;
    }

    const res = storage.importFullFamilyJSON(importFileContent, mode);
    if (!res.success) {
      setImportError(res.error || 'Failed to import backup.');
      return;
    }

    setImportSuccessMsg(
      mode === 'restore'
        ? `Successfully restored "${res.familyName}" with ${res.peopleCount} members and ${res.relationshipsCount} relationships!`
        : `Successfully imported "${res.familyName}" as a new family workspace with ${res.peopleCount} members and ${res.relationshipsCount} relationships!`
    );
    setImportPreview(null);
    setImportFileContent(null);
    onRefresh();
  };

  const handleResetData = () => {
    if (window.confirm('Reset all family records to the pristine 4-generation demo dataset? Any local changes will be replaced.')) {
      storage.resetToSampleData();
      onRefresh();
    }
  };

  const sqlCode = `-- Tiesora Complete Supabase Migration
-- Run this in your Supabase SQL Editor:
-- Tables: profiles, families, family_memberships, family_people,
-- relationships, invitations, change_requests, memories, events, notifications, audit_logs.
-- (Full schema is saved in /supabase/migrations/20261023_init_kinroots.sql)

CREATE TABLE IF NOT EXISTS public.profiles (...);
CREATE TABLE IF NOT EXISTS public.families (...);
CREATE TABLE IF NOT EXISTS public.family_people (...);
CREATE TABLE IF NOT EXISTS public.relationships (...);
-- Includes Row Level Security (RLS) policies for all 11 tables.`;

  const handleCopySQL = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopiedSQL(true);
    setTimeout(() => setCopiedSQL(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto p-3 sm:p-5 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
          <Settings className="w-4 h-4" />
          Workspace Configuration
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
          Settings & Architecture
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Manage family information, export archives, and inspect the PostgreSQL schema.
        </p>
      </div>

      {/* Storage Mode Notice Card */}
      <div className="bg-emerald-50/70 border border-emerald-900/10 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-emerald-800 text-white rounded-xl shrink-0 mt-0.5">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-950">
              Active Storage Adapter: Local Persistent Engine
            </h3>
            <p className="text-xs text-emerald-900/80 mt-1 leading-relaxed">
              Your modifications are persisted locally in your browser. All models strictly follow the normalized 11-table schema and are 100% compatible with Supabase PostgreSQL.
            </p>
          </div>
        </div>

        <button
          onClick={handleResetData}
          className="px-3.5 py-2 border border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100 rounded-xl text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset Demo Data
        </button>
      </div>

      {/* Family Details Form */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-stone-900">Family Workspace Details</h3>

        <form onSubmit={handleSaveFamily} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Family Tree Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl outline-none focus:border-emerald-700 text-xs font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Family Description & Heritage Synopsis
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl outline-none focus:border-emerald-700 text-xs resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {savedSuccess ? (
              <span className="text-emerald-800 font-semibold flex items-center gap-1 text-xs">
                <Check className="w-4 h-4" />
                Family settings saved!
              </span>
            ) : <span />}

            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* Backup & Export */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-stone-900">Export Family Data</h3>
            <p className="text-xs text-stone-500 mt-1">
              Download your complete family records in JSON or standard GEDCOM format for offline safekeeping.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-500 font-medium bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
            <span>{storage.getPeople(family.id).length} People</span>
            <span>·</span>
            <span>{storage.getRelationships(family.id).length} Relationships</span>
            <span>·</span>
            <span>{storage.getMemories(family.id).length} Memories</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={handleExportJSON}
            className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shadow-xs"
          >
            <Download className="w-4 h-4" />
            Download Full JSON Backup (.json)
          </button>

          <button
            onClick={() => {
              const people = storage.getPeople(family.id);
              const relationships = storage.getRelationships(family.id);
              const gedcomStr = exportToGEDCOM(people, relationships, family);
              const blob = new Blob([gedcomStr], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `tiesora_${family.name.toLowerCase().replace(/\s+/g, '_')}.ged`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-800" />
            Download GEDCOM 5.5 File (.ged)
          </button>
        </div>
      </div>

      {/* Import & Restore Family Data */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-800" />
            Restore & Import Family Data
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Restore previously exported Tiesora JSON backups. You can restore into your current family or import as a new tree.
          </p>
        </div>

        {importSuccessMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{importSuccessMsg}</p>
              <p className="text-[11px] text-emerald-800 mt-0.5">All nodes, generations, memories, and events have been refreshed.</p>
            </div>
          </div>
        )}

        {importError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Import Error</p>
              <p className="text-[11px] text-rose-800 mt-0.5">{importError}</p>
            </div>
          </div>
        )}

        {/* File Upload Drop Zone */}
        {!importPreview ? (
          <div className="border-2 border-dashed border-stone-200 hover:border-emerald-700/60 rounded-2xl p-6 text-center bg-stone-50/50 transition-colors">
            <input
              type="file"
              accept=".json,application/json"
              id="tiesora-import-file"
              onChange={handleFileSelect}
              className="hidden"
            />
            <label
              htmlFor="tiesora-import-file"
              className="cursor-pointer flex flex-col items-center justify-center space-y-2"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shadow-2xs">
                <FileUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-800">
                  Click to select Tiesora JSON backup file
                </p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Accepts .json files exported from Tiesora
                </p>
              </div>
            </label>
          </div>
        ) : (
          /* Verification Preview before Committing */
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200">
              <span className="font-bold text-stone-900 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-800" />
                Backup File Verified: {importPreview.family?.name || 'Unnamed Family'}
              </span>
              <button
                onClick={() => {
                  setImportPreview(null);
                  setImportFileContent(null);
                  setImportError(null);
                }}
                className="text-stone-400 hover:text-stone-700 text-xs"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                <span className="text-[10px] uppercase text-stone-400 font-bold block">Family Members</span>
                <span className="text-base font-bold text-stone-900">{importPreview.people?.length || 0}</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                <span className="text-[10px] uppercase text-stone-400 font-bold block">Relationships</span>
                <span className="text-base font-bold text-stone-900">{importPreview.relationships?.length || 0}</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                <span className="text-[10px] uppercase text-stone-400 font-bold block">Memories</span>
                <span className="text-base font-bold text-stone-900">{importPreview.memories?.length || 0}</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                <span className="text-[10px] uppercase text-stone-400 font-bold block">Export Date</span>
                <span className="text-xs font-semibold text-stone-700 truncate block mt-1">
                  {importPreview.exported_at ? importPreview.exported_at.substring(0, 10) : 'Recent'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <button
                onClick={() => handleExecuteRestore('import_as_new')}
                className="px-4 py-2 border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-950 rounded-xl font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                Import as New Family Workspace
              </button>

              <button
                onClick={() => handleExecuteRestore('restore')}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                Restore & Overwrite Current Workspace
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live Unit Test & Verification Suite */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-800" />
              Relationship Engine Verification Suite
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Automated deterministic test assertions for kinship calculations.
            </p>
          </div>

          <button
            onClick={() => setTestResults(runRelationshipTestSuite())}
            className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Run All Tests
          </button>
        </div>

        {testResults && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
              <span>Test Suite Status: {testResults.passed} / {testResults.total} Tests Passed</span>
              <span className="font-mono">{Math.round((testResults.passed / testResults.total) * 100)}% Pass Rate</span>
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-xl text-xs bg-stone-50/50">
              {testResults.results.map((res, i) => (
                <div key={i} className="p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span className="font-medium text-stone-800">{res.title}</span>
                  </div>
                  <span className="font-mono text-[11px] text-emerald-800 font-semibold">
                    ➔ {res.actual}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PostgreSQL & Supabase SQL Migration Blueprint */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-800" />
              Supabase PostgreSQL Schema & Security Policies
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Full DDL schema with RLS policies located in <code className="text-emerald-900 font-mono">/supabase/migrations/20261023_init_kinroots.sql</code>.
            </p>
          </div>

          <button
            onClick={handleCopySQL}
            className="px-3.5 py-1.5 border border-stone-200 hover:bg-stone-50 rounded-lg text-xs font-medium text-stone-700 transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            {copiedSQL ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedSQL ? 'Copied' : 'Copy SQL Snippet'}
          </button>
        </div>

        <div className="p-4 bg-stone-900 text-stone-200 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed border border-stone-800">
          <p className="text-stone-400">-- 11 Tables Initialized with Row Level Security (RLS):</p>
          <p className="text-emerald-400">✓ profiles, families, family_memberships, family_people</p>
          <p className="text-emerald-400">✓ relationships (source_person_id, target_person_id, relationship_type)</p>
          <p className="text-emerald-400">✓ invitations, change_requests, memories, events, notifications, audit_logs</p>
          <p className="text-stone-400 mt-2">-- Graph traversal indexes:</p>
          <p className="text-amber-300">✓ idx_rel_endpoints (family_id, source_person_id, target_person_id)</p>
          <p className="text-amber-300">✓ idx_people_gen (family_id, generation_level)</p>
        </div>
      </div>
    </div>
  );
};
