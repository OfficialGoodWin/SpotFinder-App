import { toast } from 'sonner';

const options = (description) => ({
  description,
  duration: 3000,
  id: 'spotfinder-draft-status',
});

export const draftToast = {
  saved: () => toast.success('Draft saved', options('Your spot is saved privately.')),
  deleted: () => toast.success('Draft deleted', options('The private draft was removed.')),
  saveFailed: () => toast.error("Couldn't save draft", options('Your changes are still here. Please try again.')),
  deleteFailed: () => toast.error("Couldn't delete draft", options('The draft is still available. Please try again.')),
};
