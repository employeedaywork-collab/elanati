import { Star } from 'lucide-react';
import { Testimonial } from '../types';

interface TestimonialsProps {
  testimonials: Testimonial[];
}

export default function Testimonials({ testimonials }: TestimonialsProps) {
  const visible = testimonials.filter((t) => t.is_visible);
  if (visible.length === 0) return null;

  return (
    <section className="py-20 bg-slate-50 border-t border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 max-w-2xl mx-auto">
          <p className="text-amber-700 text-sm font-bold mb-2">آراء التجار والموزعين</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 [text-wrap:balance]">
            ماذا يقول عملاؤنا عن تجربتهم؟
          </h2>
          <p className="text-slate-600 text-base md:text-lg">
            تقييمات حقيقية من موزعين وأصحاب محلات يعتمدون على المنصة في توسيع تجارتهم
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {visible.map((testimonial) => (
            <div
              key={testimonial.id}
              className="bg-white rounded-2xl p-7 border border-slate-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex gap-1 mb-4" aria-label={`تقييم ${testimonial.rating} من 5`}>
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 leading-relaxed mb-6 text-base">
                  "{testimonial.text}"
                </p>
              </div>
              <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
                <span className="text-3xl leading-none" aria-hidden="true">
                  {testimonial.avatar}
                </span>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{testimonial.name}</h4>
                  <p className="text-xs text-slate-500">
                    {testimonial.role} · {testimonial.city}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
