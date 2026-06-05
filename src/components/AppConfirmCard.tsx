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

/** The "is this the app you meant?" card rendered from the lookupApp tool output. */
export function AppConfirmCard({ app }: { app: AppCard }) {
  return (
    <div className="appcard">
      {app.iconUrl && <img src={app.iconUrl} alt={`${app.name} icon`} />}
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
  );
}
