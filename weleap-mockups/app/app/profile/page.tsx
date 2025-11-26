/**
 * Profile & Settings Page
 * 
 * Comprehensive configuration and transparency hub for user settings.
 */

'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { buildProfileData } from '@/lib/profile/buildProfileData';
import type { ProfilePageData } from '@/lib/profile/types';
import { getMostRecentConsent } from '@/lib/legal/getLatestConsent';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, AlertCircle, Pencil, X, Check, Shield, Mail, Lock, Link2, Download, Trash2, FileText } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const router = useRouter();
  const state = useOnboardingStore();
  
  // Build profile data from store
  const profileData = useMemo<ProfilePageData>(() => {
    return buildProfileData(state, 'user@example.com'); // TODO: Get actual user email
  }, [state]);

  // Get consent information
  const userId = 'current-user-id'; // TODO: Get from auth context
  const latestConsent = useMemo(() => {
    if (typeof window !== 'undefined') {
      return getMostRecentConsent(userId);
    }
    return null;
  }, [userId]);

  // Edit states for each section
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [localData, setLocalData] = useState<ProfilePageData>(profileData);

  // Update local data when profile data changes
  useEffect(() => {
    setLocalData(profileData);
  }, [profileData]);

  const handleSave = (section: string, updates: Partial<ProfilePageData>) => {
    setLocalData({ ...localData, ...updates });
    setEditingSection(null);
    // TODO: Save to store/API
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(0)}%`;
  };

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
          {/* 1. Onboarding Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Profile & Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Onboarding Status:</span>
                  {localData.onboarding.status === 'complete' ? (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Complete</span>
                    </div>
                  ) : localData.onboarding.status === 'in_progress' ? (
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Clock className="h-4 w-4" />
                      <span>In progress</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      <span>Not started</span>
                    </div>
                  )}
                </div>
                {localData.onboarding.completedAt && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Completed on {new Date(localData.onboarding.completedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/onboarding/income')}
                >
                  Restart onboarding
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 2. Personal & Life Stage */}
          <ProfileSection
            title="Personal & Life Stage"
            description="Context for time horizon, assumptions, and suggested goals."
            summary={`${localData.personal.ageRange}, ${localData.personal.employmentType.replace('_', ' ')}, ${localData.personal.householdStatus}, ${localData.personal.location}`}
            note="We use this to tailor timelines, risk assumptions, and recommended goals."
            isEditing={editingSection === 'personal'}
            onEdit={() => setEditingSection('personal')}
            onCancel={() => setEditingSection(null)}
            onSave={(updates) => handleSave('personal', { personal: { ...localData.personal, ...updates } })}
          >
            <PersonalLifeStageEditor
              data={localData.personal}
              onUpdate={(updates) => handleSave('personal', { personal: { ...localData.personal, ...updates } })}
            />
          </ProfileSection>

          {/* 3. Financial Connections */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Financial Connections</CardTitle>
              <CardDescription>
                Manage connected accounts and data freshness
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {localData.connections.length > 0 ? (
                <div className="space-y-3">
                  {localData.connections.map((conn, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="font-medium">{conn.institutionName}</div>
                        {conn.lastSyncAt && (
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Last sync: {new Date(conn.lastSyncAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className={`flex items-center gap-1 ${
                        conn.status === 'connected' 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {conn.status === 'connected' ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-sm">Connected</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm">Reconnect needed</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  No connected accounts
                </p>
              )}

              <div className="space-y-2 pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/onboarding/plaid-consent')}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect another account
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    // Refresh data
                    state.setLastSyncDate(new Date().toISOString());
                  }}
                >
                  Refresh data
                </Button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                We use these connections to track your spending, savings, and net worth automatically.
              </p>
            </CardContent>
          </Card>

          {/* 5. Goals & Priorities */}
          <ProfileSection
            title="Goals & Priorities"
            description="Tell the engine what outcomes to prioritize when allocating savings."
            summary={(() => {
              const goals = [];
              if (localData.goals.emergencyFundEnabled) goals.push(`EF: ${localData.goals.emergencyFundMonths}mo`);
              if (localData.goals.highInterestDebtEnabled) goals.push('Debt payoff');
              if (localData.goals.retirementEnabled) goals.push('Retirement');
              return goals.join(' · ') || 'No goals set';
            })()}
            note="Your goals guide how we prioritize emergency savings, debt payoff, retirement, and investing in your plan."
            isEditing={editingSection === 'goals'}
            onEdit={() => setEditingSection('goals')}
            onCancel={() => setEditingSection(null)}
            onSave={(updates) => handleSave('goals', { goals: { ...localData.goals, ...updates } })}
          >
            <GoalsEditor
              data={localData.goals}
              state={state}
              onUpdate={(updates) => {
                // Update store
                if (updates.emergencyFundMonths !== undefined) {
                  state.updateSafetyStrategy({ efTargetMonths: updates.emergencyFundMonths });
                }
                if (updates.debtStrategy) {
                  state.updateSafetyStrategy({ debtPayoffStrategy: updates.debtStrategy });
                }
                if (updates.retirementFocus) {
                  state.updateSafetyStrategy({ retirementFocus: updates.retirementFocus.charAt(0).toUpperCase() + updates.retirementFocus.slice(1) as any });
                }
                handleSave('goals', { goals: { ...localData.goals, ...updates } });
              }}
            />
          </ProfileSection>

          {/* 6. Security & Data */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Security & Data</CardTitle>
              <CardDescription>
                Build trust and give users control over data and account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 font-medium text-slate-900 dark:text-white">Login & Security</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Email:</span>
                      <span className="font-medium">{localData.security.email}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full">
                      Change password
                    </Button>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">2FA:</span>
                      <span className={localData.security.twoFAEnabled ? 'text-green-600' : 'text-slate-400'}>
                        {localData.security.twoFAEnabled ? 'On' : 'Off'}
                      </span>
                    </div>
                    {!localData.security.twoFAEnabled && (
                      <Button variant="outline" size="sm" className="w-full">
                        Set up 2FA
                      </Button>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="mb-2 font-medium text-slate-900 dark:text-white">Data & Privacy</h3>
                  <div className="space-y-2">
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      <Download className="mr-2 h-4 w-4" />
                      Download my data
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete my data / Close my account
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Your data is encrypted and secure. We never share your personal information.
                  </p>
                </div>

                <div className="border-t pt-4">
                  <h3 className="mb-2 font-medium text-slate-900 dark:text-white">Legal & Consents</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Terms of Service:</span>
                      <Link href="/legal/terms" className="text-sm font-medium text-primary hover:underline">
                        View Terms
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Privacy Policy:</span>
                      <Link href="/legal/privacy" className="text-sm font-medium text-primary hover:underline">
                        View Policy
                      </Link>
                    </div>
                    {latestConsent && (
                      <div className="rounded-lg border bg-slate-50 p-3 dark:bg-slate-800">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Last accepted on:
                        </p>
                        <p className="text-sm text-slate-900 dark:text-white">
                          {new Date(latestConsent.createdAt).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          ToS v{latestConsent.tosVersion} · Privacy Policy v{latestConsent.ppVersion}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="mb-2 font-medium text-slate-900 dark:text-white">Consents</h3>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={localData.security.allowAnonymizedUsage}
                      onChange={(e) => handleSave('security', {
                        security: { ...localData.security, allowAnonymizedUsage: e.target.checked }
                      })}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Allow anonymized usage data to improve WeLeap
                    </span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Reusable Profile Section Component
function ProfileSection({
  title,
  description,
  summary,
  note,
  children,
  isEditing,
  onEdit,
  onCancel,
  onSave,
}: {
  title: string;
  description: string;
  summary: string;
  note?: string;
  children: React.ReactNode;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (updates: any) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isEditing ? (
          <>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{summary}</p>
            </div>
            {note && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{note}</p>
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </>
        ) : (
          <>
            {children}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" className="flex-1" onClick={() => onSave({})}>
                <Check className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Editor Components (simplified - full implementations below)
function PersonalLifeStageEditor({ data, onUpdate }: { data: any; onUpdate: (updates: any) => void }) {
  const [formData, setFormData] = useState(data);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Age Range</label>
        <select
          value={formData.ageRange}
          onChange={(e) => setFormData({ ...formData, ageRange: e.target.value })}
          className="w-full rounded border px-3 py-2"
        >
          <option value="18-21">18-21</option>
          <option value="22-25">22-25</option>
          <option value="26-30">26-30</option>
          <option value="31-35">31-35</option>
          <option value="36-40">36-40</option>
          <option value="41-50">41-50</option>
          <option value="50+">50+</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Employment Type</label>
        <select
          value={formData.employmentType}
          onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
          className="w-full rounded border px-3 py-2"
        >
          <option value="student">Student</option>
          <option value="full_time">Full-time</option>
          <option value="part_time">Part-time</option>
          <option value="contractor">Contractor</option>
          <option value="self_employed">Self-employed</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Household Status</label>
        <select
          value={formData.householdStatus}
          onChange={(e) => setFormData({ ...formData, householdStatus: e.target.value })}
          className="w-full rounded border px-3 py-2"
        >
          <option value="single">Single</option>
          <option value="couple">Couple</option>
          <option value="family">Couple + Kids</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Location</label>
        <input
          type="text"
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          className="w-full rounded border px-3 py-2"
          placeholder="City, State"
        />
      </div>
      <Button onClick={() => onUpdate(formData)} className="w-full">Save Changes</Button>
    </div>
  );
}

function GoalsEditor({ data, onUpdate, state }: { data: any; onUpdate: (updates: any) => void; state: any }) {
  const [formData, setFormData] = useState(data);
  
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.emergencyFundEnabled}
            onChange={(e) => setFormData({ ...formData, emergencyFundEnabled: e.target.checked })}
            className="h-4 w-4"
          />
          <span>Build / maintain Emergency Fund</span>
        </label>
        {formData.emergencyFundEnabled && (
          <div className="ml-6">
            <label className="mb-1 block text-sm">Target months:</label>
            <select
              value={formData.emergencyFundMonths}
              onChange={(e) => setFormData({ ...formData, emergencyFundMonths: parseInt(e.target.value) as 3 | 6 | 9 })}
              className="w-full rounded border px-3 py-2"
            >
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
              <option value={9}>9 months</option>
            </select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.highInterestDebtEnabled}
            onChange={(e) => setFormData({ ...formData, highInterestDebtEnabled: e.target.checked })}
            className="h-4 w-4"
          />
          <span>Pay down high-interest debt</span>
        </label>
        {formData.highInterestDebtEnabled && (
          <div className="ml-6">
            <label className="mb-1 block text-sm">Strategy:</label>
            <select
              value={formData.debtStrategy}
              onChange={(e) => setFormData({ ...formData, debtStrategy: e.target.value })}
              className="w-full rounded border px-3 py-2"
            >
              <option value="avalanche">Avalanche (mathematically optimal)</option>
              <option value="snowball">Snowball (motivation-first)</option>
            </select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.retirementEnabled}
            onChange={(e) => setFormData({ ...formData, retirementEnabled: e.target.checked })}
            className="h-4 w-4"
          />
          <span>Grow retirement savings</span>
        </label>
        {formData.retirementEnabled && (
          <div className="ml-6">
            <label className="mb-1 block text-sm">Focus:</label>
            <select
              value={formData.retirementFocus}
              onChange={(e) => setFormData({ ...formData, retirementFocus: e.target.value })}
              className="w-full rounded border px-3 py-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        )}
      </div>

      <Button onClick={() => onUpdate(formData)} className="w-full">Save Changes</Button>
    </div>
  );
}

