-- First create the update function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create quarterly_closures table for storing period-end balances
CREATE TABLE public.quarterly_closures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  closure_date DATE NOT NULL,
  balances JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, closure_date)
);

-- Enable Row Level Security
ALTER TABLE public.quarterly_closures ENABLE ROW LEVEL SECURITY;

-- Create policies for quarterly_closures
CREATE POLICY "Users can view their own quarterly closures" 
ON public.quarterly_closures 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own quarterly closures" 
ON public.quarterly_closures 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quarterly closures" 
ON public.quarterly_closures 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quarterly closures" 
ON public.quarterly_closures 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_quarterly_closures_updated_at
BEFORE UPDATE ON public.quarterly_closures
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();