
-- AI Chat conversations table
CREATE TABLE public.ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova konverzacija',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Chat messages table
CREATE TABLE public.ai_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- RLS for ai_conversations: user owns their conversations + super_admin bypass
CREATE POLICY "Users can manage own conversations"
ON public.ai_conversations
FOR ALL
TO authenticated
USING (
  (auth.uid() = user_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
)
WITH CHECK (
  (auth.uid() = user_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- RLS for ai_messages: access through conversation ownership
CREATE POLICY "Users can manage messages in own conversations"
ON public.ai_messages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ai_conversations c
    WHERE c.id = conversation_id AND (
      c.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ai_conversations c
    WHERE c.id = conversation_id AND (
      c.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
    )
  )
);

-- Index for performance
CREATE INDEX idx_ai_conversations_user_company ON public.ai_conversations(user_id, company_id);
CREATE INDEX idx_ai_messages_conversation ON public.ai_messages(conversation_id);
