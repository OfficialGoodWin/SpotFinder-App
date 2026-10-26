import React, { useState } from 'react';
import { Mail, MessageSquare, Wrench } from 'lucide-react';
import { submitFeedback } from '@/api/firebaseClient';
import { useLanguage } from '@/lib/LanguageContext';
import './new-support.css';

const FEEDBACK_CATEGORIES = ['idea', 'liked', 'improvement', 'other'];
const ISSUE_TYPES = ['bug', 'map', 'publishing', 'account', 'other'];

function Field({ label, id, optional, children }) {
  return <div className="sf-new-support-field"><label htmlFor={id}>{label}{optional && <small>{optional}</small>}</label>{children}</div>;
}

export default function NewSupport({ page }) {
  const { language, t } = useLanguage();
  const L = key => t(`newSupport.${key}`);
  const isFeedback = page === 'feedback';
  const isReport = page === 'report';
  const isContact = page === 'contact';
  const [category, setCategory] = useState('');
  const [area, setArea] = useState('');
  const [message, setMessage] = useState('');
  const [steps, setSteps] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  if (!isFeedback && !isReport && !isContact) return null;

  const composeMessage = () => {
    if (isFeedback) return `[SpotFinder feedback]\n${L('category')}: ${L(`feedbackCategory.${category}`)}\n${L('message')}:\n${message.trim()}`;
    if (isReport) return `[SpotFinder issue report]\n${L('issueType')}: ${L(`issueCategory.${category}`)}\n${L('issueArea')}: ${area.trim()}\n${L('issueDescription')}:\n${message.trim()}${steps.trim() ? `\n${L('reproduction')}:\n${steps.trim()}` : ''}`;
    return `[SpotFinder support request]\n${L('helpMessage')}:\n${message.trim()}`;
  };
  const submit = async event => {
    event.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    try {
      const result = await submitFeedback({ email: email.trim(), message: composeMessage(), language });
      if (result?.data?.success !== true && result?.success !== true) throw new Error('Submission not confirmed');
      setCategory(''); setArea(''); setMessage(''); setSteps(''); setEmail(''); setStatus('sent');
    } catch (error) { setStatus(error?.code === 'functions/resource-exhausted' ? 'limited' : 'error'); }
  };
  const setValue = setter => event => { setter(event.target.value); if (status !== 'idle') setStatus('idle'); };
  const Icon = isFeedback ? MessageSquare : isReport ? Wrench : Mail;
  return <div className="sf-new-support">
    <div className="sf-new-support-intro"><span className="sf-new-support-icon"><Icon size={21} aria-hidden="true" /></span><p>{L(isFeedback ? 'feedbackIntro' : isReport ? 'reportIntro' : 'contactIntro')}</p></div>
    {isContact && <p className="sf-new-support-path">{L('contactPath')}</p>}
    <form onSubmit={submit} data-unsaved-work={category || area.trim() || message.trim() || steps.trim() || email.trim() ? 'true' : undefined}>
      {(isFeedback || isReport) && <Field id="sf-new-support-category" label={L(isReport ? 'issueType' : 'category')}><select id="sf-new-support-category" value={category} onChange={setValue(setCategory)} required><option value="">{L('choose')}</option>{(isReport ? ISSUE_TYPES : FEEDBACK_CATEGORIES).map(key => <option value={key} key={key}>{L(`${isReport ? 'issueCategory' : 'feedbackCategory'}.${key}`)}</option>)}</select></Field>}
      {isReport && <Field id="sf-new-support-area" label={L('issueArea')}><input id="sf-new-support-area" type="text" maxLength={160} value={area} onChange={setValue(setArea)} placeholder={L('issueAreaHint')} required /></Field>}
      <Field id="sf-new-support-message" label={L(isReport ? 'issueDescription' : isContact ? 'helpMessage' : 'message')}><textarea id="sf-new-support-message" rows={isReport ? 5 : 6} maxLength={isReport ? 2300 : 2500} value={message} onChange={setValue(setMessage)} placeholder={L(isReport ? 'reportMessageHint' : isContact ? 'contactMessageHint' : 'feedbackMessageHint')} required /></Field>
      {isReport && <Field id="sf-new-support-steps" label={L('reproduction')} optional={L('optional')}><textarea id="sf-new-support-steps" rows={3} maxLength={300} value={steps} onChange={setValue(setSteps)} placeholder={L('reproductionHint')} /></Field>}
      <Field id="sf-new-support-email" label={L('email')} optional={!isContact && L('optional')}><input id="sf-new-support-email" type="email" autoComplete="email" maxLength={320} value={email} onChange={setValue(setEmail)} placeholder={L('emailHint')} required={isContact} /></Field>
      {!isContact && <p className="sf-new-support-hint">{L('emailOptionalHint')}</p>}
      {status === 'sent' && <p className="sf-new-support-message" role="status">{L(isFeedback ? 'feedbackSent' : isReport ? 'reportSent' : 'contactSent')}</p>}
      {(status === 'error' || status === 'limited') && <p className="sf-new-support-message is-error" role="alert">{L(status === 'limited' ? 'rateLimited' : 'sendFailed')}</p>}
      <button className="sf-new-support-submit" type="submit" disabled={status === 'sending' || !message.trim() || (isReport && (!category || !area.trim())) || (isFeedback && !category) || (isContact && !email.trim())}>{L(status === 'sending' ? 'sending' : isFeedback ? 'sendFeedback' : isReport ? 'sendReport' : 'sendContact')}</button>
    </form>
  </div>;
}
