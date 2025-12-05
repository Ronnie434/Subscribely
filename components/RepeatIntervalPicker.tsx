import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { RepeatInterval, REPEAT_INTERVAL_CONFIG } from '../types';
import { getAllIntervals } from '../utils/repeatInterval';
import * as Haptics from 'expo-haptics';

interface RepeatIntervalPickerProps {
  visible: boolean;
  currentInterval: RepeatInterval;
  onSelect: (interval: RepeatInterval) => void;
  onClose: () => void;
}

export default function RepeatIntervalPicker({
  visible,
  currentInterval,
  onSelect,
  onClose,
}: RepeatIntervalPickerProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedInterval, setSelectedInterval] = useState(currentInterval);

  const handleDone = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelect(selectedInterval);
    onClose();
  };

  const allIntervals = getAllIntervals();

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    modalContent: {
      backgroundColor: theme.isDark ? theme.colors.card : '#FFFFFF',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.text,
    },
    doneButton: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    doneText: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    pickerContainer: {
      backgroundColor: theme.isDark ? theme.colors.card : '#FFFFFF',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <View style={{ width: 60 }} />
            <Text style={styles.headerTitle}>Select Repeat Interval</Text>
            <Pressable style={styles.doneButton} onPress={handleDone}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedInterval}
              onValueChange={(itemValue) => setSelectedInterval(itemValue as RepeatInterval)}
              style={{ height: 200 }}
              itemStyle={{ 
                color: theme.colors.text,
                fontSize: 20,
              }}>
              {allIntervals.map((interval) => (
                <Picker.Item
                  key={interval}
                  label={REPEAT_INTERVAL_CONFIG[interval].label}
                  value={interval}
                />
              ))}
            </Picker>
          </View>
        </View>
      </View>
    </Modal>
  );
}