alter table public.notifications
  drop constraint notifications_destination;

alter table public.notifications
  add constraint notifications_destination check (
    (notification_type = 'FOLLOW' and post_id is null and comment_id is null and forum_id is null)
    or (notification_type = 'ASK_RATING' and (post_id is not null or forum_id is not null))
    or (notification_type in ('COMMENT', 'REPLY') and
      ((post_id is not null and comment_id is not null and forum_id is null)
        or (forum_id is not null and post_id is null and comment_id is null)))
    or (notification_type in ('FORUM_JOIN', 'FORUM_POST') and forum_id is not null)
    or (notification_type = 'REPORT_REVIEWED' and
      post_id is null and comment_id is null and forum_id is null)
  );

create function private.notify_report_reviewed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending'::public.report_status
    and new.status = 'reviewed'::public.report_status
    and new.reviewed_by is not null then
    perform private.create_notification(
      new.reporter_id,
      new.reviewed_by,
      'REPORT_REVIEWED'::public.notification_type
    );
  end if;
  return new;
end;
$$;
revoke all on function private.notify_report_reviewed()
  from public, anon, authenticated;

create trigger reports_notify_reporter_reviewed
  after update of status on public.reports
  for each row
  when (old.status is distinct from new.status)
  execute function private.notify_report_reviewed();
