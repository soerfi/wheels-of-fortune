import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Settings, Gift, Trophy, Plus, Trash2, Edit2, Save, X, Download, Upload, Eye, Ticket, Copy } from 'lucide-react';
import Papa from 'papaparse';
import AlertModal from '../components/AlertModal';
import CodeManagerModal from '../components/CodeManagerModal';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'settings' | 'prizes' | 'winners'>('settings');
  const [settings, setSettings] = useState<any>(null);
  const [prizes, setPrizes] = useState<any[]>([]);
  const [winners, setWinners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [appAlert, setAppAlert] = useState<{ type: 'error' | 'success', message: string, title?: string } | null>(null);

  // Form states
  const initialPrizeState = {
    name: '', name_en: '', name_fr: '', name_it: '',
    color: '#EF4444',
    description: '', description_en: '', description_fr: '', description_it: '',
    mail_description: '', mail_description_en: '', mail_description_fr: '', mail_description_it: '',
    mail_instruction: '', mail_instruction_en: '', mail_instruction_fr: '', mail_instruction_it: '',
    min_order_value: '', min_order_value_en: '', min_order_value_fr: '', min_order_value_it: '',
    quantity: 10, prefix: '', custom_codes: '', is_jackpot: false, is_same_code: false
  };
  const [editingPrize, setEditingPrize] = useState<any>(null);
  const [newPrize, setNewPrize] = useState(initialPrizeState);
  const [formLang, setFormLang] = useState<'de' | 'en' | 'fr' | 'it'>('de');
  const [editLang, setEditLang] = useState<'de' | 'en' | 'fr' | 'it'>('de');
  const [generateCodesState, setGenerateCodesState] = useState<{ id: number, add_quantity: number, prefix: string } | null>(null);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        const data = await res.json();
        setAuthToken(data.token);
        setIsAuthenticated(true);
      } else {
        setAppAlert({ type: 'error', message: 'Falsches Passwort oder Rate-Limit erreicht!' });
      }
    } catch (err) {
      setAppAlert({ type: 'error', message: 'Login fehlgeschlagen.' });
    }
  };

  const fetchData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${authToken}` };
      const [sRes, pRes, wRes] = await Promise.all([
        fetch('/api/settings', { headers }),
        fetch('/api/prizes', { headers }),
        fetch('/api/winners', { headers })
      ]);
      setSettings(await sRes.json());
      setPrizes(await pRes.json());
      setWinners(await wRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(settings)
      });
      setAppAlert({ type: 'success', message: 'Einstellungen gespeichert!' });
    } catch (err) {
      setAppAlert({ type: 'error', message: 'Fehler beim Speichern.' });
    }
  };

  const handleAddPrize = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...newPrize };
      let customCodesArray: string[] = [];
      if (newPrize.is_same_code) {
        customCodesArray = Array(newPrize.quantity).fill(newPrize.custom_codes.trim()).filter(Boolean);
      } else {
        customCodesArray = newPrize.custom_codes.split('\n').map(c => c.trim()).filter(Boolean);
      }

      if (customCodesArray.length === 0) {
        setAppAlert({ type: 'error', message: 'Du musst mindestens einen Code eingeben, um einen Preis zu erstellen.' });
        return;
      }

      const reqRes = await fetch('/api/prizes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ ...payload, custom_codes: customCodesArray })
      });

      if (!reqRes.ok) {
        let errDesc = reqRes.statusText;
        try { const err = await reqRes.json(); errDesc = err.error || errDesc; } catch (e) { }
        setAppAlert({ type: 'error', message: `Fehler beim Speichern: ${errDesc}` });
        return;
      }

      setNewPrize(initialPrizeState);
      fetchData();
    } catch (err) {
      setAppAlert({ type: 'error', message: 'Fehler beim Hinzufügen.' });
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // Expect columns: Name (DE), Name EN, Name FR, Name IT, Beschreibung für Win-Pop-up (DE), ...
          const prizesMap: Record<string, any> = {};

          results.data.forEach((row: any) => {
            if (!row['Name (DE)'] && !row.Name) return; // Fallback to 'Name' for older CSVs
            const name = (row['Name (DE)'] || row.Name).trim();
            if (!prizesMap[name]) {
              prizesMap[name] = {
                name,
                name_en: row['Name EN'] || '', name_fr: row['Name FR'] || '', name_it: row['Name IT'] || '',
                description: row['Beschreibung für Win-Pop-up (DE)'] || row['Beschreibung für Win-Pop-up'] || '',
                description_en: row['Beschreibung EN'] || '', description_fr: row['Beschreibung FR'] || '', description_it: row['Beschreibung IT'] || '',
                mail_description: row['Beschreibung für Mailtext (DE)'] || row['Beschreibung für Mailtext'] || '',
                mail_description_en: row['Mailtext EN'] || '', mail_description_fr: row['Mailtext FR'] || '', mail_description_it: row['Mailtext IT'] || '',
                mail_instruction: row['Anweisung für Mail (DE)'] || row['Anweisung für Mail'] || '',
                mail_instruction_en: row['Anweisung EN'] || '', mail_instruction_fr: row['Anweisung FR'] || '', mail_instruction_it: row['Anweisung IT'] || '',
                min_order_value: row['Mindestbestellwert (DE)'] || row['Mindestbestellwert'] || '',
                min_order_value_en: row['Mindestbestellwert EN'] || '', min_order_value_fr: row['Mindestbestellwert FR'] || '', min_order_value_it: row['Mindestbestellwert IT'] || '',
                value: row.Wert || '',
                weight: parseInt(row.Gewichtung) || 1,
                is_jackpot: row['Jackpot Preis'] === '1' || row['Jackpot Preis']?.toLowerCase() === 'ja' || row['Jackpot Preis']?.toLowerCase() === 'yes',
                is_same_code: row['Same Code for all'] === '1' || row['Same Code for all']?.toLowerCase() === 'ja' || row['Same Code for all']?.toLowerCase() === 'yes',
                codes: []
              };
            }
            if (row['Gutschein Codes'] && row['Gutschein Codes'].trim() !== '') {
              prizesMap[name].codes.push(row['Gutschein Codes'].trim());
            }
          });

          const prizesPayload = Object.values(prizesMap);

          const res = await fetch('/api/admin/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ prizes: prizesPayload })
          });

          if (res.ok) {
            setAppAlert({ type: 'success', message: 'CSV Import erfolgreich!' });
            fetchData();
          } else {
            setAppAlert({ type: 'error', message: 'Fehler beim CSV Import.' });
          }
        } catch (err) {
          setAppAlert({ type: 'error', message: 'Fehler beim Verarbeiten der CSV Datei.' });
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const generateSampleCSV = () => {
    const csvContent = '\uFEFFName (DE);Name EN;Name FR;Name IT;Beschreibung für Win-Pop-up (DE);Beschreibung EN;Beschreibung FR;Beschreibung IT;Beschreibung für Mailtext (DE);Mailtext EN;Mailtext FR;Mailtext IT;Anweisung für Mail (DE);Anweisung EN;Anweisung FR;Anweisung IT;Mindestbestellwert (DE);Mindestbestellwert EN;Mindestbestellwert FR;Mindestbestellwert IT;Wert;Gewichtung;Jackpot Preis;Same Code for all;Gutschein Codes\n' +
      'Test Preis;Test Prize;Prix Test;Premio Test;Du hast etwas Tolles gewonnen!;You won something great!;Vous avez gagné!;Hai vinto!;;;;;;;;;;;;;CHF 50.-;1;0;0;TEST-123\n' +
      'Anderer Preis;;;;Ein weiterer Gewinn;;;;;;;;;;;;;;;;15% Rabatt;10;0;1;TEST-456';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'skate-ch-preise-muster.csv';
    link.click();
  };

  const exportPrizes = async () => {
    try {
      const res = await fetch('/api/admin/export-prizes', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Export failed');
      const prizesObj = await res.json();

      const csvContent = [
        ['Name (DE)', 'Name EN', 'Name FR', 'Name IT', 'Beschreibung für Win-Pop-up (DE)', 'Beschreibung EN', 'Beschreibung FR', 'Beschreibung IT', 'Beschreibung für Mailtext (DE)', 'Mailtext EN', 'Mailtext FR', 'Mailtext IT', 'Anweisung für Mail (DE)', 'Anweisung EN', 'Anweisung FR', 'Anweisung IT', 'Mindestbestellwert (DE)', 'Mindestbestellwert EN', 'Mindestbestellwert FR', 'Mindestbestellwert IT', 'Wert', 'Gewichtung', 'Jackpot Preis', 'Same Code for all', 'Gutschein Codes'],
        ...prizesObj.map((p: any) => [
          p.name || '', p.name_en || '', p.name_fr || '', p.name_it || '',
          p.description || '', p.description_en || '', p.description_fr || '', p.description_it || '',
          p.mail_description || '', p.mail_description_en || '', p.mail_description_fr || '', p.mail_description_it || '',
          p.mail_instruction || '', p.mail_instruction_en || '', p.mail_instruction_fr || '', p.mail_instruction_it || '',
          p.min_order_value || '', p.min_order_value_en || '', p.min_order_value_fr || '', p.min_order_value_it || '',
          p.value || '', p.weight || '1', p.is_jackpot ? '1' : '0', p.is_same_code ? '1' : '0',
          p.codes && p.codes.length > 0 ? p.codes.join('\n') : ''
        ].map(val => `"${String(val).replace(/"/g, '""')}"`))
      ].map(e => e.join(';')).join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `skate-ch-preise-export-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (err) {
      setAppAlert({ type: 'error', message: 'Fehler beim Exportieren der Preise.' });
    }
  };

  const handleUpdatePrize = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`/api/prizes/${editingPrize.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(editingPrize)
      });
      setEditingPrize(null);
      fetchData();
    } catch (err) {
      setAppAlert({ type: 'error', message: 'Fehler beim Aktualisieren.' });
    }
  };

  const handleCopyPrize = (prizeToCopy: any) => {
    setNewPrize({
      name: `${prizeToCopy.name} (Kopie)`,
      name_en: prizeToCopy.name_en || '',
      name_fr: prizeToCopy.name_fr || '',
      name_it: prizeToCopy.name_it || '',
      color: prizeToCopy.color || '#EF4444',
      description: prizeToCopy.description || '',
      description_en: prizeToCopy.description_en || '',
      description_fr: prizeToCopy.description_fr || '',
      description_it: prizeToCopy.description_it || '',
      mail_description: prizeToCopy.mail_description || '',
      mail_description_en: prizeToCopy.mail_description_en || '',
      mail_description_fr: prizeToCopy.mail_description_fr || '',
      mail_description_it: prizeToCopy.mail_description_it || '',
      mail_instruction: prizeToCopy.mail_instruction || '',
      mail_instruction_en: prizeToCopy.mail_instruction_en || '',
      mail_instruction_fr: prizeToCopy.mail_instruction_fr || '',
      mail_instruction_it: prizeToCopy.mail_instruction_it || '',
      min_order_value: prizeToCopy.min_order_value || '',
      min_order_value_en: prizeToCopy.min_order_value_en || '',
      min_order_value_fr: prizeToCopy.min_order_value_fr || '',
      min_order_value_it: prizeToCopy.min_order_value_it || '',
      quantity: 10,
      prefix: '',
      custom_codes: '',
      is_jackpot: prizeToCopy.is_jackpot === 1,
      is_same_code: prizeToCopy.is_same_code === 1
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setAppAlert({ type: 'success', message: 'Preis kopiert! Bitte passe nun ggf. oben den Namen an, füge Codes im Feld ein und klicke auf "Preis anlegen".' });
  };

  const [prizeToDelete, setPrizeToDelete] = useState<number | null>(null);

  const handleDeletePrize = async () => {
    if (!prizeToDelete) return;
    try {
      await fetch(`/api/prizes/${prizeToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      setPrizeToDelete(null);
      fetchData();
    } catch (err) {
      setAppAlert({ type: 'error', message: 'Fehler beim Löschen.' });
    }
  };

  // Auto-generation is removed so we just delete the redundant API routes
  const [viewingCodesFor, setViewingCodesFor] = useState<any>(null);

  const addTimeSlot = () => {
    const newSlots = [...(settings.active_slots || []), { from: new Date().toISOString(), to: new Date(Date.now() + 86400000).toISOString() }];
    setSettings({ ...settings, active_slots: newSlots });
  };

  const removeTimeSlot = (index: number) => {
    const newSlots = settings.active_slots.filter((_: any, i: number) => i !== index);
    setSettings({ ...settings, active_slots: newSlots });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8">
        <h1 className="text-4xl font-black uppercase tracking-widest text-white mb-8">
          SKATE.CH <span className="text-red-500">Admin</span>
        </h1>
        <form onSubmit={handleLogin} className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl max-w-sm w-full">
          <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Passwort eingeben</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors mb-6"
            autoFocus
          />
          <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg uppercase tracking-widest transition-colors">
            Login
          </button>
        </form>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Laden...</div>;

  const formatDatetimeLocal = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-12 border-b border-zinc-800 pb-6">
          <h1 className="text-4xl font-black uppercase tracking-widest text-white">
            SKATE.CH <span className="text-red-500">Admin</span>
          </h1>
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-colors ${activeTab === 'settings' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
            >
              <Settings size={20} /> Einstellungen
            </button>
            <button
              onClick={() => setActiveTab('prizes')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-colors ${activeTab === 'prizes' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
            >
              <Gift size={20} /> Preise
            </button>
            <button
              onClick={() => setActiveTab('winners')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-colors ${activeTab === 'winners' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
            >
              <Trophy size={20} /> Gewinner
            </button>
          </div>
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* SETTINGS TAB */}
          {activeTab === 'settings' && settings && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
              <h2 className="text-2xl font-bold mb-6 uppercase tracking-widest border-b border-zinc-800 pb-4">Allgemeine Einstellungen</h2>
              <form onSubmit={handleSaveSettings} className="space-y-6 max-w-2xl">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider">Geplante Aktivitäts-Slots</label>
                    <button type="button" onClick={addTimeSlot} className="flex items-center gap-2 text-red-500 hover:text-red-400 font-bold uppercase text-sm">
                      <Plus size={16} /> Slot Hinzufügen
                    </button>
                  </div>

                  {settings.active_slots?.map((slot: any, index: number) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-4 items-end bg-zinc-950 p-4 border border-zinc-800 rounded-lg">
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Start</label>
                        <input
                          type="datetime-local"
                          value={formatDatetimeLocal(slot.from)}
                          onChange={e => {
                            if (!e.target.value) return;
                            const newSlots = [...settings.active_slots];
                            newSlots[index].from = new Date(e.target.value).toISOString();
                            setSettings({ ...settings, active_slots: newSlots });
                          }}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-4 py-2 text-white focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Ende</label>
                        <input
                          type="datetime-local"
                          value={formatDatetimeLocal(slot.to)}
                          onChange={e => {
                            if (!e.target.value) return;
                            const newSlots = [...settings.active_slots];
                            newSlots[index].to = new Date(e.target.value).toISOString();
                            setSettings({ ...settings, active_slots: newSlots });
                          }}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-4 py-2 text-white focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <button type="button" onClick={() => removeTimeSlot(index)} className="p-2 text-zinc-500 hover:text-red-500 mb-1">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                  {(!settings.active_slots || settings.active_slots.length === 0) && (
                    <p className="text-sm text-zinc-500 italic">Keine Slots konfiguriert. Das Rad bleibt inaktiv.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Gutschein Hintergrundbild URL</label>
                  <input
                    type="url"
                    value={settings.voucher_bg_url}
                    onChange={e => setSettings({ ...settings, voucher_bg_url: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                    placeholder="https://..."
                  />
                  {settings.voucher_bg_url && (
                    <div className="mt-4 h-40 rounded-lg overflow-hidden border border-zinc-800 relative">
                      <img src={settings.voucher_bg_url} alt="Voucher Background" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold tracking-widest uppercase">Vorschau</span>
                      </div>
                    </div>
                  )}
                </div>
                <button type="submit" className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-lg font-bold uppercase tracking-widest transition-colors">
                  <Save size={20} /> Speichern
                </button>
              </form>
            </div>
          )}

          {/* PRIZES TAB */}
          {activeTab === 'prizes' && (
            <div className="space-y-8">
              {/* Add Prize Form */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
                <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
                  <h2 className="text-2xl font-bold uppercase tracking-widest">Neuen Preis hinzufügen</h2>

                  {/* Form Language Switcher */}
                  <div className="flex gap-2">
                    {['de', 'en', 'fr', 'it'].map(lang => (
                      <button
                        type="button"
                        key={lang}
                        onClick={() => setFormLang(lang as any)}
                        className={`px-4 py-2 uppercase font-bold text-xs rounded transition-colors ${formLang === lang ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleAddPrize} className="flex flex-col gap-6">
                  {(() => {
                    const l = formLang === 'de' ? '' : `_${formLang}`;
                    return (
                      <>
                        <div className="flex flex-col md:flex-row gap-6">
                          <div className="flex-[2]">
                            <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Anzeigename auf Wheel ({formLang.toUpperCase()})</label>
                            <input type="text" required={formLang === 'de'} value={(newPrize as any)[`name${l}`] || ''} onChange={e => setNewPrize({ ...newPrize, [`name${l}`]: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500" placeholder="z.B. SKATE.CH Gutschein" />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Wert</label>
                            <input type="text" value={newPrize.value} onChange={e => setNewPrize({ ...newPrize, value: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500" placeholder="z.B. CHF 50.-" />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Gewichtung</label>
                            <input type="number" min="1" value={newPrize.weight || 1} onChange={e => setNewPrize({ ...newPrize, weight: parseInt(e.target.value) || 1 })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500" placeholder="z.B. 10" />
                          </div>
                        </div>
                        <div className="flex gap-6">
                          <div className="flex-1">
                            <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Beschreibung für Win-Pop-up ({formLang.toUpperCase()})</label>
                            <textarea value={(newPrize as any)[`description${l}`] || ''} onChange={e => setNewPrize({ ...newPrize, [`description${l}`]: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500" placeholder="Du erhältst 50 CHF Rabatt auf deinen nächsten Einkauf..." rows={2} />
                          </div>
                          <div className="w-48 flex items-center bg-zinc-950 border border-zinc-800 rounded-lg px-4">
                            <label className="flex items-center gap-3 cursor-pointer w-full">
                              <input type="checkbox" checked={newPrize.is_jackpot} onChange={e => setNewPrize({ ...newPrize, is_jackpot: e.target.checked })} className="w-5 h-5 accent-yellow-500 rounded border-zinc-700 bg-zinc-900" />
                              <span className="text-sm font-bold text-yellow-500 uppercase tracking-wider">Jackpot Preis</span>
                            </label>
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-6">
                          <div className="flex-1">
                            <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Beschreibung für Mailtext ({formLang.toUpperCase()})</label>
                            <textarea value={(newPrize as any)[`mail_description${l}`] || ''} onChange={e => setNewPrize({ ...newPrize, [`mail_description${l}`]: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500" placeholder="Zeige abweichenden Text nur in der Gewinn-Mail (Optional)" rows={2} />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Anweisung für Mail ({formLang.toUpperCase()})</label>
                            <textarea value={(newPrize as any)[`mail_instruction${l}`] || ''} onChange={e => setNewPrize({ ...newPrize, [`mail_instruction${l}`]: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500" placeholder="Besuche unseren Shop, leg dies in den Korb..." rows={2} />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Mindestbestellwert ({formLang.toUpperCase()}) (Opt.)</label>
                            <input type="text" value={(newPrize as any)[`min_order_value${l}`] || ''} onChange={e => setNewPrize({ ...newPrize, [`min_order_value${l}`]: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500" placeholder="z.B. ab CHF 100.-" />
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* CODES OPTIONS */}
                  <div className="bg-zinc-950/50 p-6 rounded-lg border border-zinc-800">
                    <div className="flex justify-between items-center mb-4 border-b border-red-900/30 pb-2">
                      <h3 className="font-bold text-red-500 uppercase tracking-wider text-sm">Preis Codes</h3>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={newPrize.is_same_code} onChange={e => setNewPrize({ ...newPrize, is_same_code: e.target.checked, custom_codes: '' })} className="w-4 h-4 accent-red-500 rounded border-zinc-700 bg-zinc-900" />
                        <span className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Same Code for all</span>
                      </label>
                    </div>
                    {newPrize.is_same_code ? (
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Gutscheincode</label>
                          <input type="text" value={newPrize.custom_codes} onChange={e => setNewPrize({ ...newPrize, custom_codes: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-2 text-white focus:outline-none focus:border-red-500 font-mono" placeholder="z.B. SUPER-RABATT" />
                        </div>
                        <div className="w-32">
                          <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Anzahl</label>
                          <input type="number" min="1" value={newPrize.quantity} onChange={e => setNewPrize({ ...newPrize, quantity: parseInt(e.target.value) || 1 })} className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-2 text-white focus:outline-none focus:border-red-500" />
                        </div>
                      </div>
                    ) : (
                      <>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">1 Code pro Zeile</label>
                        <textarea value={newPrize.custom_codes} onChange={e => setNewPrize({ ...newPrize, custom_codes: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-2 text-white focus:outline-none focus:border-red-500 text-xs font-mono" placeholder="GUTSCHEIN-A11&#10;GUTSCHEIN-B22" rows={5} />
                      </>
                    )}
                  </div>

                  <button type="submit" className="w-full md:w-auto self-end flex items-center justify-center h-[50px] px-8 bg-white text-black hover:bg-zinc-200 rounded-lg font-bold uppercase tracking-widest transition-colors">
                    <Plus size={20} className="mr-2" /> Preis anlegen
                  </button>
                </form>
              </div>

              {/* CSV Import */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 border-l-4 border-l-red-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 pb-4 border-b border-zinc-800">
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-widest text-white mb-2">Alternativ: Preis & Code CSV-Import</h2>
                    <p className="text-zinc-500 text-sm">Lade das Muster herunter oder exportiere alle bestehenden Preise inkl. Codes als CSV.</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={exportPrizes} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-bold text-sm uppercase tracking-wider">
                      <Download size={16} /> Alle Preise exportieren
                    </button>
                    <button type="button" onClick={generateSampleCSV} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors font-bold text-sm uppercase tracking-wider">
                      Muster .csv
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImportCSV}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-dashed border-zinc-700 hover:border-red-500 rounded-lg text-zinc-400 hover:text-white transition-colors uppercase font-bold tracking-wider"
                  >
                    <Upload size={20} /> CSV Datei auswählen & importieren
                  </button>
                </div>
              </div>

              {/* Prizes List */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mt-8">
                <table className="w-full text-left">
                  <thead className="bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Wert / Gew.</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Menge</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {prizes.map((prize, idx) => (
                      <tr key={prize.id} className="hover:bg-zinc-800/50 transition-colors">
                        {editingPrize?.id === prize.id ? (
                          <td colSpan={4} className="p-4">
                            <form onSubmit={handleUpdatePrize} className="flex flex-col gap-4 bg-zinc-950 p-4 rounded-lg border border-zinc-700">
                              <div className="flex gap-2">
                                {['de', 'en', 'fr', 'it'].map(lang => (
                                  <button type="button" key={lang} onClick={() => setEditLang(lang as any)} className={`px-3 py-1 uppercase font-bold text-[10px] rounded transition-colors ${editLang === lang ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                                    {lang}
                                  </button>
                                ))}
                              </div>
                              {(() => {
                                const l = editLang === 'de' ? '' : `_${editLang}`;
                                return (
                                  <>
                                    <div className="flex gap-4">
                                      <input type="text" value={editingPrize[`name${l}`] || ''} onChange={e => setEditingPrize({ ...editingPrize, [`name${l}`]: e.target.value })} className="flex-[2] bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white" placeholder={`Preis Name (${editLang.toUpperCase()})...`} />
                                      <input type="text" value={editingPrize.value || ''} onChange={e => setEditingPrize({ ...editingPrize, value: e.target.value })} className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white" placeholder="Wert..." title="Wert" />
                                      <input type="number" min="1" value={editingPrize.weight || 1} onChange={e => setEditingPrize({ ...editingPrize, weight: parseInt(e.target.value) || 1 })} className="w-20 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white" placeholder="Gew." title="Gewichtung" />
                                    </div>
                                    <div className="flex gap-4 items-start">
                                      <div className="flex-1 flex flex-col gap-4">
                                        <textarea value={editingPrize[`description${l}`] || ''} onChange={e => setEditingPrize({ ...editingPrize, [`description${l}`]: e.target.value })} className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm" placeholder={`Beschreibung für Win-Pop-up (${editLang.toUpperCase()})`} rows={2} />
                                        <div className="flex gap-4">
                                          <textarea value={editingPrize[`mail_description${l}`] || ''} onChange={e => setEditingPrize({ ...editingPrize, [`mail_description${l}`]: e.target.value })} className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm" placeholder={`Beschreibung für Mailtext (${editLang.toUpperCase()})`} rows={2} />
                                          <textarea value={editingPrize[`mail_instruction${l}`] || ''} onChange={e => setEditingPrize({ ...editingPrize, [`mail_instruction${l}`]: e.target.value })} className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm" placeholder={`Anweisung für Mail (${editLang.toUpperCase()})`} rows={2} />
                                          <input type="text" value={editingPrize[`min_order_value${l}`] || ''} onChange={e => setEditingPrize({ ...editingPrize, [`min_order_value${l}`]: e.target.value })} className="w-48 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm" placeholder={`Mindestbest. (${editLang.toUpperCase()})`} />
                                        </div>
                                      </div>
                                      <div className="flex flex-col gap-3 shrink-0">
                                        <label className="flex items-center gap-3 cursor-pointer bg-zinc-900 border border-zinc-700 rounded px-4 py-2 w-48">
                                          <input type="checkbox" checked={!!editingPrize.is_jackpot} onChange={e => setEditingPrize({ ...editingPrize, is_jackpot: e.target.checked })} className="w-5 h-5 accent-yellow-500 rounded border-zinc-700 bg-zinc-950" />
                                          <span className="text-sm font-bold text-yellow-500 uppercase tracking-wider">Jackpot</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer bg-zinc-900 border border-zinc-700 rounded px-4 py-2 w-48">
                                          <input type="checkbox" checked={!!editingPrize.is_same_code} onChange={e => setEditingPrize({ ...editingPrize, is_same_code: e.target.checked })} className="w-5 h-5 accent-red-500 rounded border-zinc-700 bg-zinc-950" />
                                          <span className="text-sm font-bold text-red-500 uppercase tracking-wider text-[11px]">Same Code</span>
                                        </label>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                              <div className="flex justify-end gap-2">
                                <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white flex items-center gap-2 text-sm"><Save size={16} /> Speichern</button>
                                <button type="button" onClick={() => setEditingPrize(null)} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-white text-sm flex items-center gap-2"><X size={16} /> Abbrechen</button>
                              </div>
                            </form>
                          </td>
                        ) : (
                          <>
                            <td className="px-6 py-4">
                              <div className="font-bold text-white text-lg flex items-center gap-2">
                                {prize.is_jackpot ? <span title="Jackpot Preis" className="text-yellow-500">★</span> : null}
                                {prize.name}
                              </div>
                              {prize.description && <div className="text-sm text-zinc-500 mt-1">{prize.description}</div>}
                            </td>
                            <td className="px-6 py-4 w-40">
                              <div className="text-white bg-zinc-800 px-3 py-1 rounded inline-block text-sm mb-1">{prize.value || '-'}</div>
                              <div className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Gewichtung: <strong className="text-white font-bold">{prize.weight || 1}</strong></div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-zinc-500 mr-2 text-xs">Total: {prize.initial_quantity}</span>
                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${prize.remaining_quantity > 0 || prize.is_same_code ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                Verf: {prize.is_same_code ? '∞' : prize.remaining_quantity}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button title="Preis duplizieren" onClick={() => handleCopyPrize(prize)} className="p-2 text-zinc-400 hover:text-blue-500 transition-colors mr-2"><Copy size={18} /></button>
                              <button title="Codes verwalten" onClick={() => setViewingCodesFor(prize)} className="p-2 text-zinc-400 hover:text-green-500 transition-colors mr-2"><Ticket size={18} /></button>
                              <button title="Preis umbenennen" onClick={() => setEditingPrize(prize)} className="p-2 text-zinc-400 hover:text-white transition-colors"><Edit2 size={18} /></button>
                              <button title="Preis löschen" onClick={() => setPrizeToDelete(prize.id)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors ml-2"><Trash2 size={18} /></button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    {prizes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">Keine Preise vorhanden.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )
          }

          {/* WINNERS TAB */}
          {
            activeTab === 'winners' && (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      const csvContent = [
                        ['Datum', 'Preis', 'Code', 'Name', 'E-Mail', 'Newsletter'],
                        ...winners.map(w => [
                          new Date(w.won_at).toLocaleString('de-CH'),
                          w.prize_name || 'Unbekannt',
                          w.code,
                          w.user_name || '',
                          w.user_email || '',
                          w.newsletter ? 'Ja' : 'Nein'
                        ])
                      ].map(e => e.join(',')).join('\n');

                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = 'skate-ch-gewinner.csv';
                      link.click();
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-bold uppercase tracking-wider transition-colors"
                  >
                    <Download size={20} /> CSV Export
                  </button>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-950 border-b border-zinc-800">
                      <tr>
                        <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Datum</th>
                        <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Preis</th>
                        <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Code</th>
                        <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">E-Mail</th>
                        <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider text-center">Newsletter</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {winners.map(winner => (
                        <tr key={winner.id} className="hover:bg-zinc-800/50 transition-colors">
                          <td className="px-6 py-4 text-zinc-400">
                            {new Date(winner.won_at).toLocaleString('de-CH')}
                          </td>
                          <td className="px-6 py-4 font-bold">{winner.prize_name || 'Unbekannt'}</td>
                          <td className="px-6 py-4 font-mono text-red-400">{winner.code}</td>
                          <td className="px-6 py-4">{winner.user_name || '-'}</td>
                          <td className="px-6 py-4 text-zinc-400">{winner.user_email || '-'}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`text-xs px-2 py-1 rounded uppercase font-bold tracking-wider ${winner.newsletter ? 'bg-green-500/10 text-green-500' : 'bg-zinc-800 text-zinc-500'}`}>
                              {winner.newsletter ? 'Ja' : 'Nein'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {winners.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">Noch keine Gewinner.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          }
        </motion.div>
      </div >

      {/* DELETE CONFIRMATION MODAL */}
      {
        prizeToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-950 border-4 border-white shadow-[16px_16px_0_0_#EF4444] p-8" role="dialog" aria-modal="true">
              <h3 className="text-4xl font-display uppercase tracking-widest text-white mb-4">Löschen?</h3>
              <p className="text-zinc-400 font-bold uppercase tracking-wider mb-8">
                Möchtest du diesen Preis wirklich endgültig löschen? Alle dazugehörigen Codes werden ebenfalls entfernt.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setPrizeToDelete(null)}
                  className="flex-1 py-4 border-2 border-zinc-700 hover:border-white text-zinc-400 hover:text-white font-bold uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleDeletePrize}
                  className="flex-1 py-4 bg-red-600 hover:bg-white border-2 border-transparent hover:border-black text-white hover:text-black font-bold uppercase tracking-widest transition-all hover:-translate-y-1 hover:shadow-[-4px_4px_0_0_#000] cursor-pointer"
                >
                  Löschen
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* CODES VIEW MODAL */}
      {
        viewingCodesFor && authToken && (
          <CodeManagerModal
            prize={viewingCodesFor}
            authToken={authToken}
            onClose={() => setViewingCodesFor(null)}
            onChanged={fetchData}
          />
        )
      }

      {/* GLOBAL ALERTS */}
      {appAlert && (
        <AlertModal
          type={appAlert.type}
          title={appAlert.title}
          message={appAlert.message}
          onClose={() => setAppAlert(null)}
        />
      )}

    </div >
  );
}
