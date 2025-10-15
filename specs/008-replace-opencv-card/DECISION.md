# Detection Model Decision

**Date**: 2025-10-16  
**Decision**: Continue with DETR for card detection

## Context

We explored multiple detection approaches to replace the legacy OpenCV edge detection:
- **DETR** (DEtection TRansformer) - Facebook's object detection model
- **OpenCV** - Legacy edge detection with Canny + contours
- **OWL-ViT** - Open-vocabulary object detection

## Evaluation Results

### DETR
- ✅ Works "good enough" for current needs
- ✅ Reliable card detection in varied lighting
- ✅ Good aspect ratio filtering (MTG card specific)
- ✅ Acceptable performance (~500ms inference)
- ✅ Already integrated and tested
- ⚠️ Requires model download (~50MB)

### OpenCV (Legacy)
- ❌ Poor performance in varied lighting
- ❌ High false positive rate
- ❌ Struggles with cluttered backgrounds
- ✅ No model download required
- ✅ Fast inference
- **Verdict**: Insufficient accuracy for production use

### OWL-ViT
- ⚠️ Explored but not fully tested
- ⚠️ Larger model size
- ⚠️ More complex integration
- ⚠️ Potentially slower inference
- **Verdict**: Not worth the complexity for marginal gains

## Decision Rationale

1. **DETR meets requirements**: Provides reliable detection in the scenarios we care about
2. **Good enough is good enough**: No need to over-engineer for perfect detection
3. **Already working**: DETR is integrated, tested, and functional
4. **Time to ship**: Focus on polish and validation rather than exploring alternatives

## Next Steps

### Immediate (Phase 6: Polish)
- [ ] Remove detector factory abstraction (keep DETR only)
- [ ] Clean up OpenCV legacy code
- [ ] Add comprehensive error handling
- [ ] Update E2E tests
- [ ] Add performance monitoring
- [ ] Add JSDoc documentation

### Future Considerations
- Monitor DETR performance in production
- Collect user feedback on detection accuracy
- Consider OWL-ViT if DETR proves insufficient
- Evaluate newer models as they become available

## Lessons Learned

1. **Start simple**: DETR was the first choice and ended up being the final choice
2. **Test early**: Real-world testing revealed DETR was sufficient
3. **Avoid premature optimization**: Don't explore alternatives until current solution fails
4. **Ship iteratively**: Can always swap models later if needed

## References

- DETR Paper: https://arxiv.org/abs/2005.12872
- Transformers.js: https://huggingface.co/docs/transformers.js
- Implementation: `apps/web/src/lib/webcam.ts`
- Tasks: `specs/008-replace-opencv-card/tasks.md`
