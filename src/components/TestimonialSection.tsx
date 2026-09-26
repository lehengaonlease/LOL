import React, { useState, useEffect, useRef } from 'react';
import {
  Star,
  ChevronLeft,
  ChevronRight,
  Camera,
  MapPin,
  Quote,
  CheckCircle2,
  X,
  Upload,
  Trash2,
} from 'lucide-react';
import { CustomerTestimonial } from '../types';

interface TestimonialSectionProps {
  testimonials: CustomerTestimonial[];
  onAddTestimonial: (testimonial: CustomerTestimonial) => void;
  onDeleteTestimonial?: (id: string) => void;
}

export const TestimonialSection: React.FC<TestimonialSectionProps> = ({
  testimonials,
  onAddTestimonial,
  onDeleteTestimonial,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Customer Review Form State
  const [customerName, setCustomerName] = useState('');
  const [indoreLocation, setIndoreLocation] = useState('');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [quote, setQuote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const safeIndex =
    testimonials.length > 0 ? ((currentIndex % testimonials.length) + testimonials.length) % testimonials.length : 0;
  const activeItem = testimonials[safeIndex];

  // Auto-advance slider every 6 seconds unless paused or form open
  useEffect(() => {
    if (isPaused || isFormOpen || testimonials.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [isPaused, isFormOpen, testimonials.length]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    setFormError(null);
    setIsUploadingPhoto(true);

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const dataUrl = reader.result;
        // Show instant preview
        setPhotoUrl(dataUrl);
        try {
          const res = await fetch('/api/upload-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl, prefix: 'client-review' }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.url) {
              setPhotoUrl(data.url);
            }
          }
        } catch {
          // Keep base64 dataUrl if offline
        }
      }
      setIsUploadingPhoto(false);
    };
    reader.onerror = () => {
      setIsUploadingPhoto(false);
      setFormError('Could not read the selected photo.');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setFormError('Please enter your name.');
      return;
    }
    if (!quote.trim()) {
      setFormError('Please write a few words about your experience.');
      return;
    }
    if (!photoUrl) {
      setFormError('Please upload 1 picture of your lehenga look.');
      return;
    }

    const newReview: CustomerTestimonial = {
      id: `test-client-${Date.now()}`,
      customerName: customerName.trim(),
      indoreLocation: indoreLocation.trim() || 'Indore • Verified LOL Client',
      rating,
      quote: quote.trim(),
      photoUrl,
      createdAt: new Date().toISOString(),
    };

    onAddTestimonial(newReview);
    setCurrentIndex(0);
    setCustomerName('');
    setIndoreLocation('');
    setRating(5);
    setQuote('');
    setPhotoUrl('');
    setFormError(null);
    setIsFormOpen(false);
    setJustSubmitted(true);
    setTimeout(() => setJustSubmitted(false), 4500);
  };

  const averageRating =
    testimonials.length > 0
      ? (
          testimonials.reduce((acc, item) => acc + item.rating, 0) / testimonials.length
        ).toFixed(1)
      : '5.0';

  return (
    <section
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="py-16 sm:py-24 bg-gradient-to-b from-white via-[#FFF5F8] to-[#FFF0F5] border-t border-[#F8BBD0]/60"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Row */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-2 max-w-xl">
            <h2 className="font-editorial text-3xl sm:text-5xl font-semibold text-[#4A1525] tracking-tight">
              Loved by Indori Kudi's
            </h2>
            <p className="text-xs sm:text-sm text-[#4A1525]/70">
              Serving pure main-character energy from Vijay Nagar to New Palasia. Check out our real-life gorgeous renters below, or upload your own photo to claim your crown! 👑👑
            </p>
          </div>

          {/* Rating Summary + Add Review CTA */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-[#F8BBD0]/80 shadow-2xs">
              <div className="flex items-center gap-0.5 text-[#F59E0B]">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <span className="text-xs font-bold text-[#4A1525]">{averageRating} / 5.0</span>
              <span className="text-[11px] text-[#4A1525]/60">
                ({testimonials.length} Reviews)
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#D81B60] hover:bg-[#AD1457] text-white text-xs uppercase tracking-wider font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Add Your Photo & Review</span>
            </button>
          </div>
        </div>

        {/* Thank You Toast after Customer Submits */}
        {justSubmitted && (
          <div className="mb-8 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Thank you! Your photo and review are now live at the front of the Indore Client Love
              slider.
            </span>
          </div>
        )}

        {/* Main Split Testimonial Slider Card */}
        {activeItem && (
          <div className="relative bg-white rounded-3xl border border-[#F8BBD0]/80 shadow-[0_20px_50px_-15px_rgba(216,27,96,0.12)] overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
              {/* Left: Client's 1 Uploaded Picture (3:4 Portrait Aspect on Mobile, Full Height on Desktop) */}
              <div className="lg:col-span-5 relative aspect-[3/4] lg:aspect-auto lg:min-h-[460px] bg-[#FFF0F5] overflow-hidden">
                <img
                  key={activeItem.id}
                  src={activeItem.photoUrl}
                  alt={`${activeItem.customerName} in LOL Lehenga`}
                  className="w-full h-full object-cover object-top transition-all duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#4A1525]/70 via-transparent to-transparent" />

                {/* Bottom Overlay Badge on Client Photo */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2 text-white">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 text-[#4A1525] text-[11px] font-semibold shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#D81B60]" />
                    <span>Verified Indore Rental</span>
                  </span>
                  {activeItem.outfitCode && (
                    <span className="px-2.5 py-1 rounded-full bg-[#D81B60] text-white text-[10px] font-mono-num font-semibold">
                      {activeItem.outfitCode}
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Star Rating, Editorial Quote, Client Info & Slider Controls */}
              <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between bg-white">
                <div className="space-y-6">
                  {/* Top Row: Stars & Slide Counter */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-5 h-5 ${
                            star <= activeItem.rating
                              ? 'fill-[#F59E0B] text-[#F59E0B]'
                              : 'text-[#F8BBD0]'
                          }`}
                        />
                      ))}
                      <span className="ml-2 text-xs font-semibold text-[#D81B60]">
                        {activeItem.rating}.0 ★ Rated
                      </span>
                    </div>

                    <span className="text-xs font-mono-num font-semibold text-[#4A1525]/45">
                      {String(safeIndex + 1).padStart(2, '0')} /{' '}
                      {String(testimonials.length).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Quote Icon & Customer Quote */}
                  <div className="relative">
                    <Quote className="w-10 h-10 text-[#FCE4EC] -mb-2" />
                    <blockquote className="font-editorial text-2xl sm:text-3xl lg:text-[32px] font-medium text-[#4A1525] leading-relaxed">
                      “{activeItem.quote}”
                    </blockquote>
                  </div>

                  {/* Client Name & Indore Location */}
                  <div className="pt-4 border-t border-[#FCE4EC] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="font-editorial text-2xl font-semibold text-[#4A1525]">
                        {activeItem.customerName}
                      </h3>
                      <p className="inline-flex items-center gap-1.5 text-xs text-[#4A1525]/70 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-[#D81B60] shrink-0" />
                        <span>{activeItem.indoreLocation}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Delete Action + Prev/Next Buttons */}
                <div className="mt-8 pt-6 border-t border-[#FCE4EC] flex flex-wrap items-center justify-between gap-4">
                  {onDeleteTestimonial ? (
                    <button
                      type="button"
                      onClick={() => onDeleteTestimonial(activeItem.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF0F5] hover:bg-red-50 text-[#4A1525]/60 hover:text-red-600 border border-[#F8BBD0] text-[11px] font-medium transition-colors cursor-pointer"
                      title="Remove this review"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  {/* Prev / Next Navigation Buttons */}
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handlePrev}
                      aria-label="Previous Testimonial"
                      className="w-10 h-10 rounded-full bg-[#FFF0F5] hover:bg-[#D81B60] text-[#4A1525] hover:text-white border border-[#F8BBD0] flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      aria-label="Next Testimonial"
                      className="w-10 h-10 rounded-full bg-[#FFF0F5] hover:bg-[#D81B60] text-[#4A1525] hover:text-white border border-[#F8BBD0] flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Customer "Add Your 1 Picture, Review & Rating" */}
      {isFormOpen && (
        <div
          onClick={() => setIsFormOpen(false)}
          className="fixed inset-0 z-50 bg-[#4A1525]/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-3xl border border-[#F8BBD0] shadow-2xl overflow-hidden my-8"
          >
            {/* Modal Header */}
            <div className="px-6 py-5 bg-[#FFF0F5] border-b border-[#F8BBD0] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#D81B60] font-semibold block">
                  Share Your LOL Moment
                </span>
                <h3 className="font-editorial text-2xl font-semibold text-[#4A1525]">
                  Add Your Picture & Review
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="w-8 h-8 rounded-full bg-white border border-[#F8BBD0] flex items-center justify-center text-[#4A1525] hover:text-[#D81B60] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              {/* Step 1: Interactive Star Rating */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/75 mb-2">
                  1. Your Rating *
                </label>
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#FFF5F8] border border-[#F8BBD0]/70">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = star <= (hoverRating ?? rating);
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(null)}
                          onClick={() => setRating(star)}
                          className="p-1 transition-transform hover:scale-110 cursor-pointer"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              active
                                ? 'fill-[#F59E0B] text-[#F59E0B]'
                                : 'text-[#F8BBD0]'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-xs font-semibold text-[#D81B60] ml-2">
                    {rating === 5
                      ? '5/5 — Loved It!'
                      : rating === 4
                      ? '4/5 — Great Fit'
                      : `${rating}/5 Stars`}
                  </span>
                </div>
              </div>

              {/* Step 2: Upload 1 Picture */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/75 mb-2">
                  2. Upload 1 Picture in Your Lehenga *
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                {photoUrl ? (
                  <div className="relative flex items-center gap-4 p-3 rounded-2xl bg-[#FFF5F8] border border-[#F8BBD0]">
                    <img
                      src={photoUrl}
                      alt="Your Uploaded Look"
                      className="w-20 h-24 rounded-xl object-cover object-top border border-[#F8BBD0] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#4A1525]">
                        Photo Ready to Publish!
                      </p>
                      <p className="text-[11px] text-[#4A1525]/60 mt-0.5">
                        Looking gorgeous! You can replace this photo if you want another angle.
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-white border border-[#F8BBD0] text-[11px] font-semibold text-[#D81B60] hover:bg-[#FFF0F5] cursor-pointer"
                      >
                        Change Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="w-full py-6 px-4 rounded-2xl border-2 border-dashed border-[#F48FB1] bg-[#FFF5F8] hover:bg-[#FFF0F5] flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Upload className="w-6 h-6 text-[#D81B60]" />
                    <span className="text-xs font-semibold text-[#4A1525]">
                      {isUploadingPhoto
                        ? 'Uploading your photo...'
                        : 'Click to Select 1 Photo from Phone or Computer'}
                    </span>
                    <span className="text-[10px] text-[#4A1525]/55">
                      Supports JPG, PNG, WebP
                    </span>
                  </button>
                )}
              </div>

              {/* Step 3: Name & Indore Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/75 mb-1.5">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g., Priyal Sharma"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF5F8] border border-[#F8BBD0] text-xs text-[#4A1525] focus:outline-none focus:bg-white focus:border-[#D81B60]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/75 mb-1.5">
                    Indore Area / Wedding Venue
                  </label>
                  <input
                    type="text"
                    value={indoreLocation}
                    onChange={(e) => setIndoreLocation(e.target.value)}
                    placeholder="e.g., Vijay Nagar • Sayaji Sangeet"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF5F8] border border-[#F8BBD0] text-xs text-[#4A1525] focus:outline-none focus:bg-white focus:border-[#D81B60]"
                  />
                </div>
              </div>

              {/* Step 4: Write Whatever You Want About Us */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#4A1525]/75 mb-1.5">
                  3. Write Your Experience With Us *
                </label>
                <textarea
                  rows={3}
                  required
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  placeholder="Write whatever you loved—the fit, how many compliments you got at the Sangeet, or how much money you saved!"
                  className="w-full p-3.5 rounded-xl bg-[#FFF5F8] border border-[#F8BBD0] text-xs text-[#4A1525] focus:outline-none focus:bg-white focus:border-[#D81B60]"
                />
              </div>

              <button
                type="submit"
                disabled={isUploadingPhoto}
                className="w-full py-3.5 px-6 rounded-xl bg-[#D81B60] hover:bg-[#AD1457] text-white text-xs uppercase tracking-[0.16em] font-semibold shadow-md transition-colors cursor-pointer"
              >
                Publish My Photo & Review
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
