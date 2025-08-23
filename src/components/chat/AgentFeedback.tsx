import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquareWarning, 
  Lightbulb,
  Star
} from 'lucide-react';
import { useSelfImprovingAgents } from '@/hooks/useSelfImprovingAgents';

interface AgentFeedbackProps {
  agentId: string;
  agentName: string;
  messageId?: string;
  messageContent?: string;
  onFeedbackSubmitted?: () => void;
}

export const AgentFeedback = ({
  agentId,
  agentName,
  messageId,
  messageContent,
  onFeedbackSubmitted
}: AgentFeedbackProps) => {
  const { collectFeedback } = useSelfImprovingAgents();
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<string>('');
  const [feedbackText, setFeedbackText] = useState('');
  const [confidence, setConfidence] = useState([0.8]);
  const [suggestedResponse, setSuggestedResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const feedbackTypes = [
    { value: 'praise', label: 'Похвала', icon: ThumbsUp, color: 'text-green-600' },
    { value: 'improvement', label: 'Улучшение', icon: Lightbulb, color: 'text-yellow-600' },
    { value: 'correction', label: 'Исправление', icon: MessageSquareWarning, color: 'text-orange-600' },
    { value: 'suggestion', label: 'Предложение', icon: Star, color: 'text-blue-600' }
  ];

  const handleSubmit = async () => {
    if (!feedbackType || !feedbackText.trim()) return;

    setIsSubmitting(true);
    try {
      await collectFeedback({
        agent_id: agentId,
        message_id: messageId,
        feedback_type: feedbackType as any,
        original_response: messageContent,
        suggested_response: suggestedResponse || undefined,
        user_feedback: feedbackText,
        confidence_score: confidence[0]
      });

      // Reset form
      setFeedbackType('');
      setFeedbackText('');
      setSuggestedResponse('');
      setConfidence([0.8]);
      setIsOpen(false);

      onFeedbackSubmitted?.();
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickFeedback = async (type: 'praise' | 'improvement') => {
    const defaultTexts = {
      praise: 'Отличный ответ! Именно то, что нужно.',
      improvement: 'Хороший ответ, но может быть улучшен.'
    };

    try {
      await collectFeedback({
        agent_id: agentId,
        message_id: messageId,
        feedback_type: type,
        original_response: messageContent,
        user_feedback: defaultTexts[type],
        confidence_score: type === 'praise' ? 0.9 : 0.7
      });

      onFeedbackSubmitted?.();
    } catch (error) {
      console.error('Error submitting quick feedback:', error);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Quick feedback buttons */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => quickFeedback('praise')}
        className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
      >
        <ThumbsUp className="h-3 w-3" />
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => quickFeedback('improvement')}
        className="h-6 w-6 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
      >
        <ThumbsDown className="h-3 w-3" />
      </Button>

      {/* Detailed feedback dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Подробнее
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Обратная связь для {agentName}</DialogTitle>
            <DialogDescription>
              Ваш отзыв поможет агенту стать лучше. Опишите, что можно улучшить или что вам понравилось.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Feedback Type Selection */}
            <div>
              <Label>Тип обратной связи *</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {feedbackTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <Button
                      key={type.value}
                      variant={feedbackType === type.value ? "default" : "outline"}
                      onClick={() => setFeedbackType(type.value)}
                      className="justify-start h-auto p-3"
                    >
                      <Icon className={`h-4 w-4 mr-2 ${type.color}`} />
                      <div className="text-left">
                        <div className="font-medium">{type.label}</div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Feedback Text */}
            <div>
              <Label htmlFor="feedback-text">Ваш отзыв *</Label>
              <Textarea
                id="feedback-text"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Опишите подробно, что вам понравилось или что можно улучшить..."
                className="min-h-[100px] mt-2"
              />
            </div>

            {/* Suggested Response (for corrections/improvements) */}
            {(feedbackType === 'correction' || feedbackType === 'improvement') && (
              <div>
                <Label htmlFor="suggested-response">Предлагаемый ответ (опционально)</Label>
                <Textarea
                  id="suggested-response"
                  value={suggestedResponse}
                  onChange={(e) => setSuggestedResponse(e.target.value)}
                  placeholder="Как бы вы сформулировали ответ?"
                  className="min-h-[80px] mt-2"
                />
              </div>
            )}

            {/* Confidence Score */}
            <div>
              <Label>Уверенность в оценке: {Math.round(confidence[0] * 100)}%</Label>
              <Slider
                value={confidence}
                onValueChange={setConfidence}
                max={1}
                min={0.1}
                step={0.1}
                className="mt-2"
              />
            </div>

            {/* Original Message Preview */}
            {messageContent && (
              <div>
                <Label>Исходное сообщение агента:</Label>
                <div className="mt-2 p-3 bg-muted rounded-lg text-sm max-h-32 overflow-y-auto">
                  {messageContent}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Отмена
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!feedbackType || !feedbackText.trim() || isSubmitting}
              >
                {isSubmitting ? 'Отправка...' : 'Отправить отзыв'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
