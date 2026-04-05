import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { aiCoachService } from '@/services/aiCoachService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useAlert } from '@/template';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
}

export default function AICoachScreen() {
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your AI Cricket Coach. I can help you improve your batting skills, suggest drills, and create personalized training plans. What would you like to work on today?',
      id: 'welcome-message',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input.trim(), id: Date.now().toString() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await aiCoachService.chatWithCoach(updatedMessages);
      
      if (error) {
        showAlert('Error', error);
        setMessages(messages); // Revert
        return;
      }

      setMessages([...updatedMessages, { role: 'assistant', content: data || 'Sorry, I could not process that.', id: Date.now().toString() }]);
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      showAlert('Error', 'Failed to get response from AI Coach');
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  };

  const handleReportMessage = (messageId: string, messageContent: string) => {
    showAlert(
      'Report Response',
      'Thank you for reporting this AI response. We will review it to improve our AI Coach.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            console.log('Reported message:', messageId, messageContent);
            // In a real implementation, this would send a report to your backend
            showAlert('Reported', 'Thank you for your feedback!');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <MaterialIcons name="psychology" size={28} color={colors.primary} />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>AI Batting Coach</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message, index) => (
            <View key={message.id || index} style={styles.messageWrapper}>
              <View
                style={[
                  styles.messageBubble,
                  message.role === 'user' ? styles.userMessage : styles.assistantMessage,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    message.role === 'user' && styles.userMessageText,
                  ]}
                >
                  {message.content}
                </Text>
              </View>
              {message.role === 'assistant' && (
                <Pressable
                  style={styles.reportButton}
                  onPress={() => handleReportMessage(message.id || index.toString(), message.content)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="flag" size={16} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
          ))}
          {loading && (
            <View style={[styles.messageBubble, styles.assistantMessage]}>
              <Text style={styles.loadingText}>Thinking...</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.md }]}>
          <TextInput
            style={styles.input}
            placeholder="Ask about drills, technique, training plans..."
            placeholderTextColor="#4B5563"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            editable={!loading}
          />
          <Pressable
            style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
          >
            <MaterialIcons
              name="send"
              size={24}
              color={!input.trim() || loading ? colors.disabled : colors.textLight}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  messageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    ...typography.body,
    color: colors.text,
  },
  userMessageText: {
    color: colors.textLight,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  reportButton: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xs,
    opacity: 0.6,
  },
});
