
-- Update RLS policies so admins have coach-equivalent management rights

-- branches
DROP POLICY IF EXISTS "Coaches manage branches" ON public.branches;
CREATE POLICY "Coaches and admins manage branches" ON public.branches
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));

-- profiles
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "View own or staff" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Update own or staff" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));

-- slots
DROP POLICY IF EXISTS "Coaches manage slots" ON public.slots;
DROP POLICY IF EXISTS "Approved users view slots" ON public.slots;
CREATE POLICY "Staff manage slots" ON public.slots
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Approved users view slots" ON public.slots
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.status = 'approved' AND p.primary_branch_id = slots.branch_id
    )
  );

-- slot_assignments
DROP POLICY IF EXISTS "Coaches manage assignments" ON public.slot_assignments;
DROP POLICY IF EXISTS "View own or coach assignments" ON public.slot_assignments;
CREATE POLICY "Staff manage assignments" ON public.slot_assignments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "View own or staff assignments" ON public.slot_assignments
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));

-- reschedule_requests
DROP POLICY IF EXISTS "Coaches update requests" ON public.reschedule_requests;
DROP POLICY IF EXISTS "Students view own requests" ON public.reschedule_requests;
CREATE POLICY "Staff update requests" ON public.reschedule_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "View own or staff requests" ON public.reschedule_requests
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));

-- user_roles
DROP POLICY IF EXISTS "Coaches manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Staff manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "View own or staff roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));

-- Allow first admin self-bootstrap when none exists
CREATE POLICY "Bootstrap first admin" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    role = 'admin'
    AND user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
  );
