import React from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import './new-skeleton.css';

function Bar({ width = '100%', className = '' }) {
  return <span className={`sf-new-skeleton-bar ${className}`} style={{ width }} />;
}

function Row({ image = false }) {
  return <div className="sf-new-skeleton-row">{image && <Bar className="is-image" />}<div><Bar width="68%" /><Bar width="42%" /></div></div>;
}

export default function NewSkeleton({ kind = 'settings' }) {
  const { t } = useLanguage();
  let content;
  if (kind === 'settings' || kind === 'account') content = <div className="sf-new-skeleton-settings"><Row image /><Bar width="27%" className="is-label" /><div className="sf-new-skeleton-group"><Row image /><Row image /><Row image /></div><Bar width="31%" className="is-label" /><div className="sf-new-skeleton-group"><Row image /><Row image /></div></div>;
  else if (kind === 'accountForm') content = <div className="sf-new-skeleton-document"><Bar width="84%" /><Bar width="64%" /><Bar width="32%" className="is-label" /><Bar className="is-field" /><Bar width="27%" className="is-label" /><Bar className="is-field" /><Bar className="is-action" /></div>;
  else if (kind === 'faq') content = <div className="sf-new-skeleton-document"><Bar width="82%" /><Bar width="65%" /><Bar width="29%" className="is-label" /><div className="sf-new-skeleton-group"><Row /><Row /><Row /></div><Bar width="34%" className="is-label" /><div className="sf-new-skeleton-group"><Row /><Row /></div></div>;
  else if (kind === 'legal') content = <div className="sf-new-skeleton-document"><Bar width="46%" className="is-label" />{[0, 1, 2].map(index => <div className="sf-new-skeleton-paragraph" key={index}><Bar width="35%" /><Bar /><Bar width="92%" /><Bar width="74%" /></div>)}</div>;
  else if (kind === 'updates') content = <div className="sf-new-skeleton-document">{[0, 1, 2].map(index => <div className="sf-new-skeleton-paragraph" key={index}><Bar width="42%" /><Bar width="76%" /><Bar width="58%" /></div>)}</div>;
  else if (kind === 'nearbyCards') content = <div className="sf-new-skeleton-cards">{[0, 1, 2].map(index => <div className="sf-new-skeleton-card" key={index}><Bar className="is-photo" /><Bar width="78%" /><Bar width="46%" /></div>)}</div>;
  else if (kind === 'discoverCards') content = <div className="sf-new-skeleton-discover">{[0, 1, 2, 3].map(index => <div className="sf-new-skeleton-card" key={index}><Bar className="is-photo" /><Bar width="78%" /><Bar width="46%" /></div>)}</div>;
  else if (kind === 'nearbyRows') content = <div className="sf-new-skeleton-nearby-rows">{[0, 1, 2, 3].map(index => <Row image key={index} />)}</div>;
  else if (kind === 'detail') content = <div className="sf-new-skeleton-detail"><Bar className="is-cover" /><div><Bar width="28%" /><Bar width="78%" className="is-title" /><Bar width="54%" /><div className="sf-new-skeleton-paragraph"><Bar width="31%" /><Bar /><Bar width="90%" /><Bar width="71%" /></div><div className="sf-new-skeleton-paragraph"><Bar width="36%" /><Bar width="80%" /><Bar width="64%" /></div></div></div>;
  else if (kind === 'map') content = <div className="sf-new-skeleton-map" />;
  else content = <div className="sf-new-skeleton-paragraph"><Bar width="42%" /><Bar /><Bar width="70%" /></div>;
  return <div className={`sf-new-skeleton sf-new-skeleton--${kind}`} role="status" aria-label={t('newSkeleton.loading')}><span className="sf-new-skeleton-sr">{t('newSkeleton.loading')}</span><div aria-hidden="true">{content}</div></div>;
}
