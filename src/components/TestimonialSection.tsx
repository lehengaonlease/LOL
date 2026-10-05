import React, { useState, useRef } from 'react';
import {
  Star,
  ChevronLeft,
  ChevronRight,
  Camera,
  Quote,
  CheckCircle2,
  X,
  Upload,
  MessageCircleHeart,
} from 'lucide-react';
import { CustomerTestimonial } from '../types';
import { OptimizedImage } from './OptimizedImage';
import { uploadMediaToCloud } from '../services/firebaseSyncService';
import { TransparentCameraVideoPopup, unlockCameraAudio } from './TransparentCameraVideoPopup';

interface TestimonialSectionProps {
  testimonials: CustomerTestimonial[];
  onAddTestimonial: (testimonial: CustomerTestimonial) => void;
}

export const TestimonialSection: React.FC<TestimonialSectionProps> = ({
  testimonials,
  onAddTestimonial,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTestimonialId, setSelectedTestimonialId] = useState<string | null>(null);

  // Customer Review Form State
  const [customerName, setCustomerName] = useState('');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [quote, setQuote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [showCameraPopup, setShowCameraPopup] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedIndex = selectedTestimonialId
    ? testimonials.findIndex((t) => t.id === selectedTestimonialId)
    : -1;
  const selectedTestimonial =
    selectedIndex >= 0 ? testimonials[selectedIndex] : null;

  const handlePrevModal = () => {
    if (testimonials.length <= 1 || selectedIndex < 0) return;
    const prevIdx = (selectedIndex - 1 + testimonials.length) % testimonials.length;
    setSelectedTestimonialId(testimonials[prevIdx].id);
  };

  const handleNextModal = () => {
    if (testimonials.length <= 1 || selectedIndex < 0) return;
    const nextIdx = (selectedIndex + 1) % testimonials.length;
    setSelectedTestimonialId(testimonials[nextIdx].id);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    setFormError(null);
    const localObjectUrl = URL.createObjectURL(file);
    setPhotoPreviewUrl(localObjectUrl);
    setIsUploadingPhoto(true);

    // Read immediately as persistent base64 Data URL so photoUrl is NEVER an ephemeral blob: URL
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      setPhotoUrl(base64Data);

      try {
        const cloudUrl = await uploadMediaToCloud(file, 'client-review');
        if (cloudUrl && !cloudUrl.startsWith('blob:')) {
          setPhotoUrl(cloudUrl);
        }
      } catch {
        // Base64 dataUrl remains active and will be converted into a permanent file on the backend
      } finally {
        setIsUploadingPhoto(false);
      }
    };
    reader.onerror = () => {
      setIsUploadingPhoto(false);
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
    if (isUploadingPhoto) {
      setFormError('Please wait a moment while your photo finishes uploading.');
      return;
    }
    if (!photoUrl || photoUrl.startsWith('blob:')) {
      setFormError('Please upload 1 picture of your lehenga look.');
      return;
    }

    const newReview: CustomerTestimonial = {
      id: `test-client-${Date.now()}`,
      customerName: customerName.trim(),
      indoreLocation: 'Indore • Verified LOL Client',
      rating,
      quote: quote.trim(),
      photoUrl,
      createdAt: new Date().toISOString(),
    };

    unlockCameraAudio();
    onAddTestimonial(newReview);
    setCustomerName('');
    setRating(5);
    setQuote('');
    setPhotoUrl('');
    setPhotoPreviewUrl('');
    setFormError(null);
    setIsFormOpen(false);
    setJustSubmitted(true);
    setShowCameraPopup(false);
    setTimeout(() => setShowCameraPopup(true), 20);
    setTimeout(() => setJustSubmitted(false), 4500);
  };

  const averageRating =
    testimonials.length > 0
      ? (
          testimonials.reduce((acc, item) => acc + item.rating, 0) / testimonials.length
        ).toFixed(1)
      : '5.0';

  const shouldAutoSlide = testimonials.length >= 5;

  const renderReviewCard = (item: CustomerTestimonial, keySuffix = '') => (
    <div
      key={`${item.id}${keySuffix}`}
      onClick={() => setSelectedTestimonialId(item.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSelectedTestimonialId(item.id);
        }
      }}
      className={`group relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#FFF0F5] border border-[#F8BBD0]/80 shadow-[0_12px_32px_-12px_rgba(216,27,96,0.16)] hover:shadow-[0_20px_40px_-12px_rgba(216,27,96,0.26)] transition-all duration-300 cursor-pointer ${
        shouldAutoSlide
          ? 'w-[240px] sm:w-[275px] lg:w-[290px] shrink-0'
          : 'w-full max-w-[300px]'
      }`}
    >
      <OptimizedImage
        src={item.photoUrl}
        alt={`${item.customerName} in LOL Lehenga`}
        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
      />

      {/* Smooth dark gradient at the bottom so lower-left name & rating are always clearly legible */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

      {/* Subtle badge if Studio replied */}
      {item.adminReply && (
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-xs border border-[#F8BBD0] text-[#D81B60] text-[10px] font-semibold inline-flex items-center gap-1 shadow-xs pointer-events-none">
          <MessageCircleHeart className="w-3 h-3" />
          <span>Studio Replied</span>
        </div>
      )}

      {/* Lower-Left Overlay: Renter Rating + Renter Name */}
      <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 flex flex-col items-start justify-end text-left pointer-events-none">
        <div className="flex items-center gap-1 mb-1.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`w-3.5 h-3.5 ${
                star <= item.rating
                  ? 'fill-[#FBBF24] text-[#FBBF24]'
                  : 'text-white/40'
              }`}
            />
          ))}
          <span className="ml-1 text-[11px] font-semibold text-white/95">
            {item.rating}.0
          </span>
        </div>

        <h3 className="font-editorial text-xl sm:text-2xl font-semibold text-white leading-tight drop-shadow-xs line-clamp-1">
          {item.customerName}
        </h3>
      </div>
    </div>
  );

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-white via-[#FFF5F8] to-[#FFF0F5] border-t border-[#F8BBD0]/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Row */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="space-y-2 max-w-xl">
            <h2 className="font-editorial text-3xl sm:text-5xl font-semibold text-[#4A1525] tracking-tight">
              Loved by Indori Kudi's
            </h2>
            <p className="text-xs sm:text-sm text-[#4A1525]/70">
              Serving pure main-character energy from Vijay Nagar to New Palasia. Tap any photo below to read their review, or upload your own photo to claim your crown! 👑👑
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
                ({testimonials.length} {testimonials.length === 1 ? 'Review' : 'Reviews'})
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-[#D81B60] to-[#E91E63] hover:from-[#AD1457] hover:to-[#C2185B] text-white text-xs uppercase tracking-wider font-semibold shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer"
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
              Thank you! Your photo and review are now framed in the Indore Client Love gallery.
            </span>
          </div>
        )}

        {/* Up to 4 Reviews: 4-across Grid | 5+ Reviews: Slow Auto-Sliding Loop to the Left */}
        {testimonials.length > 0 && (
          shouldAutoSlide ? (
            <div className="relative w-full overflow-hidden py-2">
              <div className="animate-reviews-marquee gap-4 sm:gap-6">
                {testimonials.map((item) => renderReviewCard(item, '-set1'))}
                {testimonials.map((item) => renderReviewCard(item, '-set2'))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {testimonials.map((item) => renderReviewCard(item))}
            </div>
          )
        )}
      </div>

      {/* Modal: Full Review Details when a user clicks on any 4:5 renter image (No Delete Option on Front End) */}
      {selectedTestimonial && (
        <div
          onClick={() => setSelectedTestimonialId(null)}
          className="fixed inset-0 z-50 bg-[#4A1525]/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl bg-white rounded-3xl border border-[#F8BBD0] shadow-2xl overflow-hidden grid grid-cols-1 sm:grid-cols-12"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedTestimonialId(null)}
              aria-label="Close Review"
              className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-white/90 hover:bg-white border border-[#F8BBD0] flex items-center justify-center text-[#4A1525] hover:text-[#D81B60] shadow-xs cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Left: 4:5 Image */}
            <div className="sm:col-span-5 relative aspect-[4/5] bg-[#FFF0F5] overflow-hidden">
              <OptimizedImage
                src={selectedTestimonial.photoUrl}
                alt={selectedTestimonial.customerName}
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
              <div className="absolute bottom-3.5 left-4 right-4 text-left text-white pointer-events-none">
                <div className="flex items-center gap-1 mb-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-3.5 h-3.5 ${
                        star <= selectedTestimonial.rating
                          ? 'fill-[#FBBF24] text-[#FBBF24]'
                          : 'text-white/40'
                      }`}
                    />
                  ))}
                  <span className="ml-1 text-[11px] font-semibold">
                    {selectedTestimonial.rating}.0
                  </span>
                </div>
                <p className="font-editorial text-xl font-semibold leading-tight">
                  {selectedTestimonial.customerName}
                </p>
              </div>
            </div>

            {/* Right: Customer Review, Studio Reply & Prev/Next Controls */}
            <div className="sm:col-span-7 p-6 sm:p-8 flex flex-col justify-between bg-white">
              <div className="space-y-4">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= selectedTestimonial.rating
                          ? 'fill-[#F59E0B] text-[#F59E0B]'
                          : 'text-[#F8BBD0]'
                      }`}
                    />
                  ))}
                  <span className="ml-1.5 text-xs font-semibold text-[#D81B60]">
                    {selectedTestimonial.rating}.0 ★ Verified Review
                  </span>
                </div>

                <div className="relative pt-1">
                  <Quote className="w-8 h-8 text-[#FCE4EC] -mb-1" />
                  <blockquote className="font-editorial text-xl sm:text-2xl font-medium text-[#4A1525] leading-relaxed">
                    “{selectedTestimonial.quote}”
                  </blockquote>
                </div>

                <div className="pt-3 border-t border-[#FCE4EC]">
                  <h4 className="font-editorial text-xl font-semibold text-[#4A1525]">
                    {selectedTestimonial.customerName}
                  </h4>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#D81B60] font-medium mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verified LOL Renter</span>
                  </span>
                </div>

                {/* Official Studio Reply (if Admin replied from Backend) */}
                {selectedTestimonial.adminReply && (
                  <div className="p-3.5 rounded-2xl bg-[#FFF0F5] border border-[#F8BBD0] space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[#D81B60]">
                      <MessageCircleHeart className="w-3.5 h-3.5" />
                      <span>Reply from LOL By Sanjeevani</span>
                    </div>
                    <p className="text-xs text-[#4A1525]/90 leading-relaxed">
                      {selectedTestimonial.adminReply}
                    </p>
                  </div>
                )}
              </div>

              {testimonials.length > 1 && (
                <div className="mt-6 pt-4 border-t border-[#FCE4EC] flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handlePrevModal}
                    aria-label="Previous Review"
                    className="w-8 h-8 rounded-full bg-[#FFF0F5] hover:bg-[#D81B60] text-[#4A1525] hover:text-white border border-[#F8BBD0] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextModal}
                    aria-label="Next Review"
                    className="w-8 h-8 rounded-full bg-[#FFF0F5] hover:bg-[#D81B60] text-[#4A1525] hover:text-white border border-[#F8BBD0] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

                {photoPreviewUrl || photoUrl ? (
                  <div className="relative flex items-center gap-4 p-3 rounded-2xl bg-[#FFF5F8] border border-[#F8BBD0]">
                    <div className="w-20 aspect-[4/5] rounded-xl overflow-hidden border border-[#F8BBD0] bg-white shrink-0">
                      <OptimizedImage
                        src={photoPreviewUrl || photoUrl}
                        alt="Your Uploaded Look"
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#4A1525]">
                        {isUploadingPhoto ? 'Processing photo...' : 'Photo Ready to Publish!'}
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

              {/* Step 3: Name */}
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
                onClick={() => unlockCameraAudio()}
                disabled={isUploadingPhoto}
                className={`w-full py-3.5 px-6 rounded-xl text-white text-xs uppercase tracking-[0.16em] font-semibold shadow-md transition-all ${
                  isUploadingPhoto
                    ? 'bg-gray-400 cursor-not-allowed opacity-75'
                    : 'bg-[#D81B60] hover:bg-[#AD1457] active:scale-[0.99] cursor-pointer'
                }`}
              >
                {isUploadingPhoto ? 'Uploading Photo to Cloud...' : 'Publish My Photo & Review'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Frameless 1-Time Camera Video Popup */}
      <TransparentCameraVideoPopup
        isOpen={showCameraPopup}
        onComplete={() => setShowCameraPopup(false)}
      />
    </section>
  );
};
