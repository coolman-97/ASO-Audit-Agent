export interface AppCard {
  name: string;
  developer: string;
  iconUrl: string;
  primaryGenre: string;
  country: string;
  averageUserRating: number | null;
  userRatingCount: number | null;
  trackViewUrl: string;
}

interface Props {
  app: AppCard;
  actionable: boolean;
  onConfirm: () => void;
  onReject: () => void;
}

/** The "is this the app you meant?" card rendered from the lookupApp tool output. */
export function AppConfirmCard({ app, actionable, onConfirm, onReject }: Props) {
  return (
    <div className="appcard">
      <div className="appcard__top">
        {app.iconUrl && <img className="appcard__icon" src={app.iconUrl} alt={`${app.name} icon`} />}
        <div>
          <div className="appcard__name">{app.name}</div>
          <div className="appcard__meta">
            {app.developer} · {app.primaryGenre} · {app.country.toUpperCase()}
          </div>
          {app.averageUserRating != null && (
            <div className="appcard__rating">
              ★ {app.averageUserRating.toFixed(2)}
              {app.userRatingCount != null && ` · ${app.userRatingCount.toLocaleString()} ratings`}
            </div>
          )}
        </div>
      </div>
      {actionable && (
        <>
          <div className="appcard__ask">Is this the app you meant?</div>
          <div className="appcard__actions">
            <button className="btn btn--primary" onClick={onConfirm}>Yes, run the audit</button>
            <button className="btn btn--ghost" onClick={onReject}>No, different app</button>
          </div>
        </>
      )}
    </div>
  );
}
