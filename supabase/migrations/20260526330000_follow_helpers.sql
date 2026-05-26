-- ============================================================================
-- FOLLOW helpers: RPC toggle, RPC counts e is_following
-- ============================================================================

create or replace function toggle_follow(p_followed_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error', 'auth_required'); end if;
  if v_uid = p_followed_id then return jsonb_build_object('error', 'cannot_follow_self'); end if;
  delete from follows where follower_id = v_uid and followed_id = p_followed_id;
  if found then
    return jsonb_build_object('following', false);
  end if;
  insert into follows (follower_id, followed_id) values (v_uid, p_followed_id);
  return jsonb_build_object('following', true);
end$$;

grant execute on function toggle_follow(uuid) to authenticated;

create or replace function follow_stats(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'followers_count', (select count(*) from follows where followed_id = p_user_id),
    'following_count', (select count(*) from follows where follower_id = p_user_id),
    'is_following',    case when auth.uid() is null then false
                            else exists (select 1 from follows where follower_id = auth.uid() and followed_id = p_user_id) end
  );
$$;

grant execute on function follow_stats(uuid) to anon, authenticated;
