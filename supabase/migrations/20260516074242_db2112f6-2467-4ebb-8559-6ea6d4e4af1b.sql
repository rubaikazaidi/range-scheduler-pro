
CREATE POLICY "Branch peers view assignments"
ON public.slot_assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.slots s
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE s.id = slot_assignments.slot_id
      AND p.status = 'approved'
      AND p.primary_branch_id = s.branch_id
  )
);

CREATE POLICY "Branch peers view profile names"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.status = 'approved'
      AND me.primary_branch_id = profiles.primary_branch_id
  )
);
