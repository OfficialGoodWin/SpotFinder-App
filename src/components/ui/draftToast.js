import { toast } from 'sonner';

const options = (description, duration = 3500) => ({
  description,
  duration,
  id: 'spotfinder-draft-status',
});

export const notify = {
  success: (title, description) => toast.success(title, options(description)),
  error: (title, description) => toast.error(title, options(description, 7000)),
  warning: (title, description) => toast.warning(title, options(description, 5000)),
  info: (title, description) => toast.info(title, options(description, 4000)),
};

export const draftToast = {
  saved: () => notify.success('Draft saved', 'Your spot is saved privately.'),
  deleted: () => notify.success('Draft deleted', 'Your unpublished spot has been removed.'),
  saveFailed: () => notify.error("Couldn't save draft", 'Your changes are still here. Please try again.'),
  deleteFailed: () => notify.error("Couldn't delete draft", 'Please try again.'),
  published: () => notify.success('Spot published', 'Your spot is now visible on the map.'),
};
