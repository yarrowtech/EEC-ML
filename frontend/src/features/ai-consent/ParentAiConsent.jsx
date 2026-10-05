import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import { parentApiJson } from '../../parents/parentApi';

export default function ParentAiConsent({ studentId, childName }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const path = `/api/ai-consent/parent/${encodeURIComponent(studentId)}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setStatus(null);
    setError('');
    setMessage('');
    parentApiJson(path, { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setStatus(result.data);
    }).catch((err) => {
      if (!controller.signal.aborted) setError(err.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [path, retry]);

  const save = useCallback(async (granted) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await parentApiJson(path, { method: 'PUT', body: JSON.stringify({ granted }) });
      setStatus(result.data);
      setMessage(granted ? 'AI personalisation enabled.' : 'AI personalisation withdrawn. Future personalised requests are blocked.');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }, [path]);

  return (
    <section aria-label="AI personalisation consent" className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <h2 className="font-semibold text-slate-900">AI personalisation for {childName || 'your child'}</h2>
      <p className="mt-2 text-slate-600">Allow learning progress, knowledge gaps and saved learning context to personalise tutor replies and AI parent reports. AI may use an external provider configured by your school.</p>
      <p className="mt-2 text-slate-600">You can withdraw at any time. The course-material tutor remains available, and submitted questions still need AI processing. Withdrawal does not erase saved records or cancel requests already in progress; contact the school for deletion requests.</p>
      {loading && <p role="status" className="mt-3">Loading consent…</p>}
      {!loading && status && <>
        <p className="mt-3 font-medium">Personalisation: {status.allowed ? 'On' : 'Off'}</p>
        {status.reason === 'org_policy_no_consent_required' && <p className="mt-1 text-slate-600">Enabled by school policy. You can still withdraw for your child.</p>}
        <button type="button" disabled={saving} onClick={() => save(!status.allowed)} className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : status.allowed ? 'Withdraw AI personalisation' : 'Allow AI personalisation'}
        </button>
      </>}
      {error && <div className="mt-3"><p role="alert" className="text-red-700">{error}</p>{!status && !loading && <button type="button" onClick={() => setRetry((n) => n + 1)} className="mt-2 underline">Retry consent status</button>}</div>}
      {message && <p role="status" className="mt-3 text-green-800">{message}</p>}
    </section>
  );
}

ParentAiConsent.propTypes = {
  studentId: PropTypes.string.isRequired,
  childName: PropTypes.string,
};
