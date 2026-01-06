-- Create report_settings table for tax configuration and account classification
CREATE TABLE public.report_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tax_rate NUMERIC NOT NULL DEFAULT 25,
  tax_enabled BOOLEAN NOT NULL DEFAULT false,
  cost_of_sales_keywords TEXT[] NOT NULL DEFAULT ARRAY['costo de venta', 'costo de mercancia', 'costo de mercadería', 'costo mercaderia', 'costo producto'],
  operating_expense_keywords TEXT[] NOT NULL DEFAULT ARRAY['gasto', 'administrativo', 'venta', 'flete', 'operativo', 'general'],
  other_expense_keywords TEXT[] NOT NULL DEFAULT ARRAY['it', 'interes', 'interés', 'comision', 'comisión', 'bancario', 'financiero'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.report_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own report settings" 
ON public.report_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own report settings" 
ON public.report_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own report settings" 
ON public.report_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own report settings" 
ON public.report_settings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_report_settings_updated_at
BEFORE UPDATE ON public.report_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();