/** Settings section card, matching the "IntrovertHubs UI Mockups" `.card` style. */
export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] bg-card/80 p-[18px] ring-1 ring-foreground/5">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {description ? (
        <p className="mt-1 mb-4 text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
