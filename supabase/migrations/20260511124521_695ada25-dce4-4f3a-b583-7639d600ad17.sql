
-- Roles enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('coach', 'student');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role check function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Branches
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TYPE public.profile_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  primary_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  status profile_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Slots
CREATE TABLE public.slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  slot_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  capacity int NOT NULL DEFAULT 10,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_slots_branch_date ON public.slots(branch_id, slot_date);

-- Slot assignments
CREATE TABLE public.slot_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES public.slots(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot_id, student_id)
);
ALTER TABLE public.slot_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_assignments_student ON public.slot_assignments(student_id);

-- Reschedule requests
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.reschedule_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_assignment_id uuid REFERENCES public.slot_assignments(id) ON DELETE SET NULL,
  requested_slot_id uuid NOT NULL REFERENCES public.slots(id) ON DELETE CASCADE,
  note text,
  status request_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reschedule_requests ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, primary_branch_id, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'primary_branch_id', '')::uuid,
    'pending'
  );
  -- default role: student
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger for profiles
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== RLS Policies =====

-- branches
CREATE POLICY "Authenticated can view branches" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coaches manage branches" ON public.branches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coach')) WITH CHECK (public.has_role(auth.uid(), 'coach'));

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'coach'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'coach'));

-- user_roles (only coaches can read/manage; users can read their own)
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Coaches manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coach')) WITH CHECK (public.has_role(auth.uid(), 'coach'));

-- slots
CREATE POLICY "Approved users view slots" ON public.slots FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'approved' AND p.primary_branch_id = slots.branch_id)
  );
CREATE POLICY "Coaches manage slots" ON public.slots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coach')) WITH CHECK (public.has_role(auth.uid(), 'coach'));

-- slot_assignments
CREATE POLICY "View own or coach assignments" ON public.slot_assignments FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Coaches manage assignments" ON public.slot_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coach')) WITH CHECK (public.has_role(auth.uid(), 'coach'));

-- reschedule_requests
CREATE POLICY "Students view own requests" ON public.reschedule_requests FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Students create own requests" ON public.reschedule_requests FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());
CREATE POLICY "Coaches update requests" ON public.reschedule_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'coach')) WITH CHECK (public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Students delete own pending requests" ON public.reschedule_requests FOR DELETE TO authenticated
  USING (student_id = auth.uid() AND status = 'pending');
